import os
import json
import boto3
from boto3.dynamodb.conditions import Key

# Make boto3 talk to LocalStack reliably from inside the Lambda container
AWS_ENDPOINT = os.environ.get("AWS_ENDPOINT", "http://localstack:4566")
dynamodb = boto3.resource(
    "dynamodb",
    endpoint_url=AWS_ENDPOINT,
    region_name="us-east-1",
    aws_access_key_id="test",
    aws_secret_access_key="test"
)

results_table = dynamodb.Table("Results")
quizzes_table = dynamodb.Table("Quizzes")

def handler(event, context):
    print(f"Get Past Quizzes Event: {json.dumps(event)}")
    
    # Get query parameters
    query_params = event.get("queryStringParameters") or {}
    user_id = query_params.get("userId", "anonymous")
    
    print(f"Looking for past quizzes for user_id: {user_id}")
    
    try:
        # Query the Results table to find all quizzes this user has completed
        print(f"Querying Results table for userId: {user_id}")
        results_response = results_table.query(
            KeyConditionExpression=Key('userId').eq(user_id)
        )
        
        past_quizzes = []
        results_items = results_response.get('Items', [])
        
        print(f"Found {len(results_items)} result records")
        
        # For each result, get the corresponding quiz data
        for result in results_items:
            quiz_id = result.get('quizId')
            if not quiz_id:
                continue
                
            try:
                # Get the quiz details from the Quizzes table
                quiz_response = quizzes_table.get_item(
                    Key={"userId": user_id, "quizId": quiz_id}
                )
                quiz_item = quiz_response.get("Item")
                
                if quiz_item:
                    # Combine quiz metadata with result data
                    past_quiz = {
                        "quizId": quiz_id,
                        "topic": quiz_item.get("topic", "Unknown Topic"),
                        "difficulty": quiz_item.get("difficulty", "Unknown"),
                        "score": result.get("score", 0),
                        "totalQuestions": result.get("totalQuestions", 0),
                        "percentage": float(result.get("percentage", 0)),
                        "submittedAt": result.get("submittedAt"),
                        "status": "completed"
                    }
                    past_quizzes.append(past_quiz)
                    
            except Exception as e:
                print(f"Error fetching quiz {quiz_id}: {str(e)}")
                continue
        
        # Sort by submission date (most recent first)
        past_quizzes.sort(key=lambda x: x.get("submittedAt", ""), reverse=True)
        
        print(f"Successfully retrieved {len(past_quizzes)} past quizzes")
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            "body": json.dumps({
                "pastQuizzes": past_quizzes,
                "totalCount": len(past_quizzes)
            }, default=str)
        }
        
    except Exception as e:
        print(f"Error getting past quizzes: {str(e)}")
        print(f"Exception type: {type(e).__name__}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            "body": json.dumps({"error": "Internal server error", "details": str(e)})
        }