import os
import json
import boto3
import requests
import re
import logging
import uuid
from datetime import datetime
from botocore.exceptions import ClientError

try:
    from json_repair import repair_json
except ImportError:
    repair_json = None

logger = logging.getLogger()
logger.setLevel(logging.INFO)

AWS_ENDPOINT = os.environ.get("AWS_ENDPOINT", "http://localstack:4566")

# DynamoDB
dynamodb = boto3.resource(
    "dynamodb",
    endpoint_url=AWS_ENDPOINT,
    region_name="us-east-1",
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", "test"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY", "test")
)
table = dynamodb.Table("Quizzes")

# SQS client
sqs = boto3.client(
    "sqs",
    endpoint_url=AWS_ENDPOINT,
    region_name="us-east-1",
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", "test"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY", "test")
)

OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "deepseek/deepseek-r1-0528-qwen3-8b:free"

def build_prompt(topic, content=None, num_questions=5, difficulty="medium"):
    if content:
        return (
            f"Generate {num_questions} multiple-choice questions about the following text, "
            f"on the topic of \"{topic}\" at {difficulty} difficulty level.\n\n"
            f"Content:\n---\n{content}\n---\n\n"
            "Each question should have 4 options. Mark which option is correct.\n"
            "Return ONLY valid JSON in this exact format:\n\n"
            '{\n  "quiz": [\n    {\n      "text": "Question text",\n      "options": [\n        {"id":"a","text":"Option 1","correct":true},\n        {"id":"b","text":"Option 2","correct":false},\n        {"id":"c","text":"Option 3","correct":false},\n        {"id":"d","text":"Option 4","correct":false}\n      ]\n    }\n  ]\n}\n\n'
            "Make sure JSON parses cleanly (no extra commentary). And make sure one option exactly is marked correct per question."
        )
    else:
        return (
            f"Generate {num_questions} multiple-choice questions about the topic \"{topic}\" "
            f"at {difficulty} difficulty level.\n"
            "Each question should have 4 options. Mark which option is correct.\n"
            "Return ONLY valid JSON in this exact format:\n\n"
            '{\n  "quiz": [\n    {\n      "text": "Question text",\n      "options": [\n        {"id":"a","text":"Option 1","correct":true},\n        {"id":"b","text":"Option 2","correct":false},\n        {"id":"c","text":"Option 3","correct":false},\n        {"id":"d","text":"Option 4","correct":false}\n      ]\n    }\n  ]\n}\n\n'
            "Make sure JSON parses cleanly (no extra commentary). And make sure one option exactly is marked correct per question."
        )

def call_ai(prompt):
    if not OPENROUTER_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not set")
    headers = {
        "Authorization": f"Bearer {OPENROUTER_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "You are a helpful assistant that outputs only pure JSON and nothing else. If content is provided, base the quiz on that content. If only a topic is given, generate questions from general knowledge."},
            {"role": "user", "content": prompt}
        ]
    }
    r = requests.post(OPENROUTER_URL, headers=headers, json=data, timeout=60)
    r.raise_for_status()
    resp = r.json()
    return resp['choices'][0]['message']['content']

def _basic_json_repair(s: str) -> str:
    """Minimal inline repair fallback if json_repair is not available."""
    s = re.sub(r"'", '"', s)  # naive single→double quotes
    s = re.sub(r",(\s*[}\]])", r"\1", s)  # remove trailing commas
    return s

def extract_json_from_text(text):
    if not isinstance(text, str):
        raise ValueError("AI output is not a string")

    # Trim any code block markers
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned)
    
    # Pre-process: Truncate at the last valid character for a JSON object to prevent 'unhashable type' errors
    last_brace = cleaned.rfind('}')
    last_bracket = cleaned.rfind(']')
    
    # Find the last valid ending character. If neither is found, we can't repair it.
    if last_brace == -1 and last_bracket == -1:
        raise ValueError("Could not find start of JSON object in AI output")
        
    truncate_at = max(last_brace, last_bracket)
    truncated_text = cleaned[:truncate_at+1]
    
    # Now try repair on the truncated, more sane string
    if repair_json:
        try:
            repaired_text = repair_json(truncated_text)
            return json.loads(repaired_text).get("quiz", json.loads(repaired_text))
        except Exception as e:
            logger.info(f"Advanced json_repair on truncated text failed: {e}")
    
    # Fallback to basic regex-based repair
    try:
        repaired_text = _basic_json_repair(truncated_text)
        return json.loads(repaired_text).get("quiz", json.loads(repaired_text))
    except Exception as e:
        logger.info(f"Basic json_repair failed on truncated text: {e}")

    # Final attempt to find a valid object
    match = re.search(r"(\{.*\})", truncated_text, re.DOTALL)
    if match:
        candidate = match.group(1)
        try:
            if repair_json:
                repaired = repair_json(candidate)
                return json.loads(repaired).get("quiz", json.loads(repaired))
            else:
                repaired = _basic_json_repair(candidate)
                return json.loads(repaired).get("quiz", json.loads(repaired))
        except Exception as e:
            logger.info(f"Aggressive regex and repair failed: {e}")
            
    raise ValueError("Could not parse JSON from AI output")

def claim_quiz(user_id, quiz_id, processor_id):
    now = datetime.now().isoformat()
    try:
        table.update_item(
            Key={"userId": user_id, "quizId": quiz_id},
            UpdateExpression="SET #status = :processing, claimedAt = :now, processorId = :pid",
            ConditionExpression="#status = :generating",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":processing": "PROCESSING",
                ":generating": "GENERATING",
                ":now": now,
                ":pid": processor_id
            },
            ReturnValues="ALL_NEW"
        )
        logger.info("Claim succeeded for %s/%s by %s", user_id, quiz_id, processor_id)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            logger.info("Claim failed (already claimed or status changed) for %s/%s", user_id, quiz_id)
            return False
        logger.exception("DynamoDB error during claim")
        raise

# Cache queue url per ARN
_queue_url_cache = {}

def get_queue_url_from_arn(queue_arn):
    if queue_arn in _queue_url_cache:
        return _queue_url_cache[queue_arn]
    queue_name = queue_arn.split(":")[-1]
    resp = sqs.get_queue_url(QueueName=queue_name)
    url = resp["QueueUrl"]
    _queue_url_cache[queue_arn] = url
    return url

def handler(event, context):
    logger.info("Generate Quiz Event: %s", json.dumps(event))
    for record in event.get("Records", []):
        user_id = None
        quiz_id = None
        processor_id = str(uuid.uuid4())
        claimed = False
        queue_url = None
        try:
            message = json.loads(record["body"])
            user_id = message["userId"]
            quiz_id = message["quizId"]
            topic = message.get("topic", "General")
            content = message.get("content")
            num_questions = message.get("numQuestions", 5)
            difficulty = message.get("difficulty", "medium")

            logger.info("Processing message %s for user %s / quiz %s", record.get("messageId"), user_id, quiz_id)

            # Resolve queue url
            event_source_arn = record.get("eventSourceARN") or record.get("eventSourceArn")
            if event_source_arn:
                try:
                    queue_url = get_queue_url_from_arn(event_source_arn)
                except Exception:
                    queue_url = None

            # 1) Claim quiz
            claimed = claim_quiz(user_id, quiz_id, processor_id)
            if not claimed:
                continue

            # 2) Call AI
            logger.info("Generating quiz for user %s, topic: %s", user_id, topic)
            prompt = build_prompt(topic, content, num_questions, difficulty)
            ai_response = call_ai(prompt)
            logger.debug("Full AI response: %s", ai_response)  # keep full output in debug
            logger.info("AI response (first 400 chars): %s", ai_response[:400])
            quiz_data = extract_json_from_text(ai_response)

            # 3) Save quiz
            table.update_item(
                Key={"userId": user_id, "quizId": quiz_id},
                UpdateExpression="SET #status = :status, quiz = :quiz, #completed = :completed REMOVE claimedAt, processorId",
                ExpressionAttributeNames={
                    "#status": "status",
                    "#completed": "completedAt"
                },
                ExpressionAttributeValues={
                    ":status": "READY",
                    ":quiz": quiz_data,
                    ":completed": datetime.now().isoformat()
                }
            )
            logger.info("Quiz %s generated successfully and marked READY", quiz_id)

            # 4) Delete message
            if queue_url:
                receipt = record.get("receiptHandle")
                if receipt:
                    sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=receipt)
                    logger.info("Deleted SQS message %s from %s", record.get("messageId"), queue_url)

        except Exception as e:
            logger.exception("Error generating quiz for %s/%s", user_id, quiz_id)
            if claimed and user_id and quiz_id:
                try:
                    table.update_item(
                        Key={"userId": user_id, "quizId": quiz_id},
                        UpdateExpression="SET #status = :generating, #error = :err REMOVE claimedAt, processorId",
                        ExpressionAttributeNames={
                            "#status": "status",
                            "#error": "error"
                        },
                        ExpressionAttributeValues={
                            ":generating": "GENERATING",
                            ":err": str(e)
                        }
                    )
                    logger.info("Reverted status to GENERATING for retry: %s/%s", user_id, quiz_id)
                except Exception:
                    logger.exception("Failed to revert status after error for %s/%s", user_id, quiz_id)
            raise

    logger.info("Handler completed successfully for %d record(s)", len(event.get("Records", [])))
    return {"statusCode": 200}