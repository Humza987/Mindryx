import os
import json
import boto3
import uuid
from datetime import datetime

# Grab env vars
AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
AWS_ENDPOINT = os.environ.get("AWS_ENDPOINT")
QUEUE_URL = os.environ["QUEUE_URL"]

# Initialize clients/resources
sqs = boto3.client(
    "sqs",
    region_name=AWS_REGION,
    endpoint_url=AWS_ENDPOINT
)

dynamodb = boto3.resource(
    "dynamodb",
    region_name=AWS_REGION,
    endpoint_url=AWS_ENDPOINT
)

def handler(event, context):
    print(f"Request Quiz Event: {json.dumps(event)}")

    # Parse request body
    body = event.get("body")
    if isinstance(body, str):
        data = json.loads(body)
    else:
        data = body or {}

    user_id = data.get("userId", "anonymous")
    quiz_id = "quiz-" + str(uuid.uuid4())[:8]

    # Create quiz request
    quiz_request = {
        "userId": user_id,
        "quizId": quiz_id,
        "topic": data.get("topic", "General"),
        "numQuestions": int(data.get("numQuestions", 5)),
        "difficulty": data.get("difficulty", "medium"),
        "timestamp": datetime.now().isoformat()
    }
    
    # Check for and include PDF content
    content = data.get("content")
    if content:
        quiz_request["content"] = content

    # Store initial quiz record with GENERATING status
    table = dynamodb.Table("Quizzes")
    table.put_item(Item={
        "userId": user_id,
        "quizId": quiz_id,
        "status": "GENERATING",
        "createdAt": datetime.now().isoformat(),
        "topic": quiz_request["topic"],
        "numQuestions": quiz_request["numQuestions"],
        "difficulty": quiz_request["difficulty"]
    })

    # Send to SQS for generation
    sqs.send_message(
        QueueUrl=QUEUE_URL,
        MessageBody=json.dumps(quiz_request)
    )

    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Content-Type": "application/json"
        },
        "body": json.dumps({
            "status": "generating",
            "quizId": quiz_id,
            "userId": user_id
        })
    }