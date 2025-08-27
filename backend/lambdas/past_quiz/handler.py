import os
import json
import boto3
from boto3.dynamodb.conditions import Key, Attr
from decimal import Decimal

# LocalStack friendly default
AWS_ENDPOINT = os.environ.get("AWS_ENDPOINT", "http://localstack:4566")

dynamodb = boto3.resource(
    "dynamodb",
    endpoint_url=AWS_ENDPOINT,
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", "test"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY", "test")
)

RESULTS_TABLE_NAME = os.environ.get("RESULTS_TABLE", "Results")
QUIZZES_TABLE_NAME = os.environ.get("QUIZZES_TABLE", "Quizzes")

results_table = dynamodb.Table(RESULTS_TABLE_NAME)
quizzes_table = dynamodb.Table(QUIZZES_TABLE_NAME)


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles Decimal objects from DynamoDB."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            # Convert Decimal to int if it's a whole number, otherwise to float
            if obj % 1 == 0:
                return int(obj)
            else:
                return float(obj)
        return super(DecimalEncoder, self).default(obj)


def _convert_decimals(obj):
    """
    Recursively convert Decimal objects to int/float in nested structures.
    This is an alternative approach to using a custom JSON encoder.
    """
    if isinstance(obj, dict):
        return {k: _convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_decimals(v) for v in obj]
    elif isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    else:
        return obj


def _safe_int(value, default=0):
    try:
        if isinstance(value, Decimal):
            return int(value)
        return int(value)
    except Exception:
        try:
            return int(float(value))
        except Exception:
            return default


def _safe_float(value, default=0.0):
    try:
        if isinstance(value, Decimal):
            return float(value)
        return float(value)
    except Exception:
        return default


def _normalize_question(raw_q, q_index):
    """
    Convert many possible question formats into the frontend-friendly shape:
    { id: str, text: str, options: [{id, text, correct: bool}, ...] }
    """
    q = {}
    # id
    q_id = raw_q.get("id") or raw_q.get("questionId") or raw_q.get("qid") or f"q{q_index}"
    q["id"] = str(q_id)

    # text
    q_text = raw_q.get("text") or raw_q.get("question") or raw_q.get("prompt") or ""
    q["text"] = q_text

    # options - try several common keys
    raw_options = raw_q.get("options") or raw_q.get("answers") or raw_q.get("choices") or []
    normalized_options = []

    # If quiz stores only correctOptionId, use that to mark correct flags
    correct_id = raw_q.get("correctOptionId") or raw_q.get("correct")  # could be id or boolean
    # if correct is boolean per option, we will use that below

    for idx, opt in enumerate(raw_options):
        # opt might be string, or object
        if isinstance(opt, str):
            opt_id = f"{q['id']}_o{idx}"
            opt_text = opt
            opt_correct = False
        elif isinstance(opt, dict):
            opt_id = opt.get("id") or opt.get("optionId") or opt.get("choiceId") or f"{q['id']}_o{idx}"
            opt_text = opt.get("text") or opt.get("label") or opt.get("value") or ""
            # Determine correct:
            opt_correct = bool(opt.get("correct")) if "correct" in opt else False
            # If quiz stores correct as an explicit field on question:
            if not opt_correct and correct_id is not None:
                try:
                    opt_correct = str(opt_id) == str(correct_id)
                except Exception:
                    pass
        else:
            opt_id = f"{q['id']}_o{idx}"
            opt_text = str(opt)
            opt_correct = False

        normalized_options.append({
            "id": str(opt_id),
            "text": opt_text,
            "correct": bool(opt_correct)
        })

    # If no option had correct: try question-level correctAnswer or correctOptionId arrays
    if not any(o["correct"] for o in normalized_options):
        # check for array of correct ids
        correct_list = raw_q.get("correctOptionIds") or raw_q.get("correctOptions") or []
        try:
            correct_set = set(map(str, correct_list))
        except Exception:
            correct_set = set()
        if correct_set:
            for o in normalized_options:
                if o["id"] in correct_set:
                    o["correct"] = True

    q["options"] = normalized_options
    return q


def handler(event, context):
    """
    Lambda handler that returns details for a single past quiz in the format the frontend expects.

    Expected invocation:
      GET /past-quiz/{quizId}?userId={userId}

    This function:
      - extracts userId from query string (defaults to 'anonymous')
      - extracts quizId from pathParameters or other possible places
      - looks up the user's result record for that quiz (from Results table)
      - looks up the quiz definition (from Quizzes table)
      - normalizes and returns both quiz.questions and userAnswers in expected format
    """
    print("Event:", json.dumps(event))

    # Extract query params and path param robustly
    query_params = event.get("queryStringParameters") or {}
    user_id = query_params.get("userId") or query_params.get("userID") or "anonymous"

    # pathParameters may be present for API Gateway / Lambda proxy
    path_params = event.get("pathParameters") or {}
    quiz_id = path_params.get("quizId") or path_params.get("id")

    # If not present, try to parse from rawPath or resource or the final segment of path
    if not quiz_id:
        # AWS Lambda proxy may provide 'rawPath' or requestContext http path
        raw_path = event.get("rawPath") or event.get("path") or ""
        if raw_path:
            # take last path segment
            try:
                quiz_id = raw_path.rstrip("/").split("/")[-1]
            except Exception:
                quiz_id = None

    # final fallback: query param 'quizId'
    if not quiz_id:
        quiz_id = query_params.get("quizId") or query_params.get("id")

    if not quiz_id:
        return {
            "statusCode": 400,
            "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
            "body": json.dumps({"error": "Missing quizId in path or query parameters"})
        }

    print(f"Looking up quizId={quiz_id} for userId={user_id}")

    try:
        # 1) Find the result record for this user + quizId
        # We'll query by userId (partition) and then find the item with quizId
        results_resp = results_table.query(
            KeyConditionExpression=Key("userId").eq(user_id)
        )
        results_items = results_resp.get("Items", [])
        result_item = None
        for r in results_items:
            # support 'quizId' or 'quiz_id' variants
            if str(r.get("quizId") or r.get("quiz_id") or "") == str(quiz_id):
                result_item = r
                break

        # If not found via query, try a scan filtered by userId & quizId (safer with unknown schema)
        if not result_item:
            print("Result item not found in query by userId; falling back to scan")
            scan_filter = Attr("quizId").eq(quiz_id) & Attr("userId").eq(user_id)
            scan_resp = results_table.scan(FilterExpression=scan_filter)
            for r in scan_resp.get("Items", []):
                result_item = r
                break

        if not result_item:
            # Not found -> return 404
            return {
                "statusCode": 404,
                "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
                "body": json.dumps({"error": "Result for quizId not found for this user"})
            }

        print("Found result item:", json.dumps(result_item, cls=DecimalEncoder))

        # Convert Decimal objects in the result_item
        result_item = _convert_decimals(result_item)

        # Extract userAnswers from result - try several possible keys
        user_answers = result_item.get("userAnswers") or result_item.get("answers") or result_item.get("selectedOptions") or result_item.get("responses") or {}
        # ensure keys are strings
        user_answers = {str(k): str(v) for k, v in (user_answers.items() if isinstance(user_answers, dict) else {})}

        # numeric fields
        score = _safe_int(result_item.get("score"), default=0)
        total_questions = _safe_int(result_item.get("totalQuestions") or result_item.get("total_questions") or result_item.get("total"), default=0)
        percentage = _safe_float(result_item.get("percentage") or result_item.get("percent") or (100.0 if total_questions and score == total_questions else 0.0), default=0.0)

        submitted_at = result_item.get("submittedAt") or result_item.get("submitted_at") or result_item.get("timestamp")

        # 2) Fetch the quiz definition from Quizzes table using the same approach as getquiz
        print(f"Attempting DynamoDB get_item with Key: userId={user_id}, quizId={quiz_id}")
        
        try:
            response = quizzes_table.get_item(Key={"userId": user_id, "quizId": quiz_id})
            print(f"DynamoDB response: {json.dumps(response, default=str)}")
            quiz_item = response.get("Item")
        except Exception as e:
            print(f"Error getting quiz from DynamoDB: {str(e)}")
            quiz_item = None

        if not quiz_item:
            # Return partial data (result-only) but indicate quiz metadata missing
            print("Quiz metadata not found; returning result-only response")
            body = {
                "quizId": quiz_id,
                "topic": result_item.get("topic") or "Unknown",
                "difficulty": result_item.get("difficulty") or "Unknown",
                "quiz": {"quiz": []},       # empty because we couldn't find questions
                "userAnswers": user_answers,
                "score": score,
                "totalQuestions": total_questions,
                "percentage": percentage,
                "submittedAt": submitted_at,
                "userId": user_id,
                "status": result_item.get("status") or "completed"
            }
            return {
                "statusCode": 200,
                "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
                "body": json.dumps(body, cls=DecimalEncoder)
            }

        print("Successfully retrieved quiz item")
        print("Found quiz item:", json.dumps({k: quiz_item.get(k) for k in ("quizId", "topic", "difficulty") if k in quiz_item}, cls=DecimalEncoder))

        # Convert Decimal objects in the quiz_item
        quiz_item = _convert_decimals(quiz_item)

        # 3) Normalize quiz questions into the frontend format
        # The quiz item should contain the questions directly as returned by the getquiz lambda
        # Look for the quiz structure in the quiz_item
        raw_questions = None
        
        # First check if quiz_item has a 'quiz' field with 'quiz' array (common structure)
        if isinstance(quiz_item.get("quiz"), dict) and isinstance(quiz_item.get("quiz").get("quiz"), list):
            raw_questions = quiz_item.get("quiz").get("quiz")
        # Or if questions are directly under 'quiz' key
        elif isinstance(quiz_item.get("quiz"), list):
            raw_questions = quiz_item.get("quiz")
        # Or try common question keys
        else:
            for key in ("questions", "quizQuestions", "items", "questionsList"):
                candidate = quiz_item.get(key)
                if isinstance(candidate, list):
                    raw_questions = candidate
                    break

        # Default to empty list if still not found
        if raw_questions is None:
            raw_questions = []
            print("Warning: Could not find questions in quiz item structure")

        print(f"Found {len(raw_questions)} questions in quiz")

        normalized_questions = []
        for idx, raw_q in enumerate(raw_questions):
            try:
                normalized_questions.append(_normalize_question(raw_q, idx))
            except Exception as e:
                print(f"Error normalizing question idx={idx}: {str(e)}")
                # Skip problematic question but continue
                continue

        past_quiz = {
            "quizId": quiz_id,
            "topic": quiz_item.get("topic") or quiz_item.get("title") or "Unknown Topic",
            "difficulty": quiz_item.get("difficulty") or quiz_item.get("level") or "Unknown",
            "quiz": {"quiz": normalized_questions},
            "userAnswers": user_answers,
            "score": score,
            "totalQuestions": total_questions or len(normalized_questions),
            "percentage": percentage,
            "submittedAt": submitted_at,
            "userId": user_id,
            "status": result_item.get("status") or "completed"
        }

        print("Returning past_quiz summary:", json.dumps({
            "quizId": past_quiz["quizId"],
            "topic": past_quiz["topic"],
            "questionsCount": len(normalized_questions),
            "score": past_quiz["score"]
        }, cls=DecimalEncoder))

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            "body": json.dumps(past_quiz, cls=DecimalEncoder)
        }

    except Exception as e:
        import traceback
        print("Unhandled error:", str(e))
        print(traceback.format_exc())
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
            "body": json.dumps({"error": "Internal server error", "details": str(e)})
        }