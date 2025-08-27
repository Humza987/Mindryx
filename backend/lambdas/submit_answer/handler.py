from decimal import Decimal
import os, json, boto3
from datetime import datetime

# Set up LocalStack endpoint
AWS_ENDPOINT = os.environ.get("AWS_ENDPOINT", "http://localstack:4566")
print(f"Using LocalStack endpoint: {AWS_ENDPOINT}")

# DynamoDB resource
dynamodb = boto3.resource(
    "dynamodb",
    endpoint_url=AWS_ENDPOINT,
    region_name="us-east-1",
    aws_access_key_id="test",
    aws_secret_access_key="test"
)

quizzes_table = dynamodb.Table("Quizzes")
results_table = dynamodb.Table("Results")

def handler(event, context):
    print(f"Submit Answer Event: {json.dumps(event, default=str)}")

    # --- Parse event payload ---
    data = None
    if isinstance(event, dict) and "userId" in event and "quizId" in event:
        # Direct Lambda invocation
        print("Direct Lambda invocation detected")
        data = event
    elif isinstance(event, dict) and "body" in event:
        # API Gateway invocation
        print("API Gateway invocation detected")
        body = event.get("body")
        if isinstance(body, str):
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                return _response(400, {"error": "Invalid JSON in body"})
        else:
            data = body or {}
    else:
        data = event

    print(f"Parsed data: {data}")

    user_id = data.get("userId", "anonymous")
    quiz_id = data.get("quizId")
    answers = data.get("answers", {})

    if not quiz_id:
        return _response(400, {"error": "Missing quizId"})

    try:
        # --- Fetch quiz ---
        quiz_response = quizzes_table.get_item(Key={"userId": user_id, "quizId": quiz_id})
        quiz_item = quiz_response.get("Item")
        if not quiz_item or not quiz_item.get("quiz"):
            return _response(404, {"error": "Quiz not found"})

        # --- Normalize quiz questions ---
        quiz_field = quiz_item.get("quiz")
        quiz_questions = None

        if isinstance(quiz_field, list):
            quiz_questions = quiz_field
        elif isinstance(quiz_field, dict):
            if "quiz" in quiz_field and isinstance(quiz_field["quiz"], list):
                quiz_questions = quiz_field["quiz"]
            elif "questions" in quiz_field and isinstance(quiz_field["questions"], list):
                quiz_questions = quiz_field["questions"]
            else:
                for key, value in quiz_field.items():
                    if isinstance(value, list):
                        quiz_questions = value
                        break

        if not quiz_questions:
            return _response(500, {"error": "Quiz has unexpected schema"})

        # --- Grade quiz ---
        score = 0
        total_questions = len(quiz_questions)

        for i, question in enumerate(quiz_questions):
            if not isinstance(question, dict):
                continue

            # Use explicit string ids to match frontend (you create ids as index strings)
            question_id = question.get("id", str(i))

            # Support both dict and list answers from client
            user_answer = None
            if isinstance(answers, dict):
                # answers keys may be strings ("0") — keep that consistent
                user_answer = answers.get(str(question_id))
                if user_answer is None:
                    # fall back to integer key if provided that way
                    user_answer = answers.get(int(question_id)) if question_id.isdigit() else None
            elif isinstance(answers, list):
                for a in answers:
                    if a.get("questionId") == question_id or a.get("questionId") == str(question_id):
                        user_answer = a.get("answer")
                        break

            # Find the correct option id for this question (initialize per question)
            correct_option_id = None
            options = question.get("options", [])
            if isinstance(options, list):
                for option in options:
                    if isinstance(option, dict) and option.get("correct") is True:
                        correct_option_id = option.get("id")
                        break

            # If we found a correct option id, compare; otherwise treat as incorrect
            if correct_option_id is not None and user_answer is not None and str(user_answer) == str(correct_option_id):
                score += 1
            else:
                # optional: log ambiguous questions for debugging
                if correct_option_id is None:
                    print(f"Warning: question {question_id} has no correct option flagged. Treating as incorrect.")

        # --- Store results ---
        percentage = Decimal(str(round((score / total_questions) * 100, 1))) if total_questions > 0 else Decimal('0')
        result_item = {
            "userId": user_id,
            "quizId": quiz_id,
            "answers": answers,
            "score": score,
            "totalQuestions": total_questions,
            "percentage": percentage,
            "submittedAt": datetime.now().isoformat()
        }

        results_table.put_item(Item=result_item)

        # --- Return response ---
        return _response(200, {
            "score": score,
            "totalQuestions": total_questions,
            "percentage": float(percentage)
        })

    except Exception as e:
        import traceback
        print("Error submitting answers:", traceback.format_exc())
        return _response(500, {"error": "Internal server error", "details": str(e)})

# --- Helper function for API Gateway response ---
def _response(status_code, body_dict):
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json"
        },
        "body": json.dumps(body_dict)
    }
