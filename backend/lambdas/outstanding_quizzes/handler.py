import os
import json
import boto3
from boto3.dynamodb.conditions import Key
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
            if obj % 1 == 0:
                return int(obj)
            else:
                return float(obj)
        return super(DecimalEncoder, self).default(obj)


def handler(event, context):
    """
    Lambda handler that returns outstanding quizzes for a user.
    
    Outstanding quizzes are those that exist in the Quizzes table 
    but don't have corresponding results in the Results table.
    
    Expected invocation:
      GET /outstanding-quizzes?userId={userId}
    
    Returns:
      {
        "outstandingQuizzes": [
          {
            "quizId": "quiz-123",
            "topic": "Geography",
            "difficulty": "easy",
            "createdAt": "2025-08-22T10:30:00Z"
          }
        ]
      }
    """
    print("Event:", json.dumps(event))
    
    # Extract query parameters
    query_params = event.get("queryStringParameters") or {}
    user_id = query_params.get("userId") or query_params.get("userID") or "anonymous"
    
    print(f"Looking up outstanding quizzes for userId={user_id}")
    
    try:
        # 1) Get all quizzes for this user from Quizzes table
        print("Querying Quizzes table...")
        quizzes_resp = quizzes_table.query(
            KeyConditionExpression=Key("userId").eq(user_id)
        )
        quiz_items = quizzes_resp.get("Items", [])
        print(f"Found {len(quiz_items)} quizzes for user")
        
        # 2) Get all results for this user from Results table
        print("Querying Results table...")
        results_resp = results_table.query(
            KeyConditionExpression=Key("userId").eq(user_id)
        )
        result_items = results_resp.get("Items", [])
        print(f"Found {len(result_items)} results for user")
        
        # 3) Create set of completed quiz IDs
        completed_quiz_ids = set()
        for result in result_items:
            quiz_id = result.get("quizId") or result.get("quiz_id")
            if quiz_id:
                completed_quiz_ids.add(str(quiz_id))
        
        print(f"Completed quiz IDs: {completed_quiz_ids}")
        
        # 4) Find outstanding quizzes (in Quizzes but not in Results)
        outstanding_quizzes = []
        for quiz in quiz_items:
            quiz_id = quiz.get("quizId")
            if quiz_id and str(quiz_id) not in completed_quiz_ids:
                # This quiz is outstanding
                outstanding_quiz = {
                    "quizId": str(quiz_id),
                    "topic": quiz.get("topic") or quiz.get("title") or "Unknown Topic",
                    "difficulty": quiz.get("difficulty") or quiz.get("level") or "Unknown",
                    "createdAt": quiz.get("createdAt") or quiz.get("created_at") or quiz.get("timestamp") or ""
                }
                outstanding_quizzes.append(outstanding_quiz)
        
        print(f"Found {len(outstanding_quizzes)} outstanding quizzes")
        
        # 5) Sort by creation date (newest first) if available
        def get_sort_key(quiz):
            created_at = quiz.get("createdAt", "")
            return created_at if created_at else "0000-00-00T00:00:00Z"
        
        outstanding_quizzes.sort(key=get_sort_key, reverse=True)
        
        response_body = {
            "outstandingQuizzes": outstanding_quizzes,
            "count": len(outstanding_quizzes),
            "userId": user_id
        }
        
        print("Returning outstanding quizzes:", json.dumps({
            "count": len(outstanding_quizzes),
            "quizIds": [q["quizId"] for q in outstanding_quizzes]
        }))
        
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            "body": json.dumps(response_body, cls=DecimalEncoder)
        }
        
    except Exception as e:
        import traceback
        print("Error getting outstanding quizzes:", str(e))
        print(traceback.format_exc())
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            "body": json.dumps({
                "error": "Internal server error",
                "details": str(e)
            })
        }