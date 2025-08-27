import os
import json
import boto3

# Make boto3 talk to LocalStack reliably from inside the Lambda container
AWS_ENDPOINT = os.environ.get("AWS_ENDPOINT", "http://localstack:4566")
dynamodb = boto3.resource(
    "dynamodb",
    endpoint_url=AWS_ENDPOINT,
    region_name="us-east-1",
    aws_access_key_id="test",
    aws_secret_access_key="test"
)
table = dynamodb.Table("Quizzes")

def handler(event, context):
    print(f"Get Quiz Event: {json.dumps(event)}")
    
    # Get path parameters
    path_params = event.get("pathParameters") or {}
    quiz_id = path_params.get("quizId")
    
    # Get query parameters
    query_params = event.get("queryStringParameters") or {}
    user_id = query_params.get("userId", "anonymous")
    
    print(f"Looking for quiz_id: {quiz_id}, user_id: {user_id}")
    
    if not quiz_id:
        return {
            "statusCode": 400,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            "body": json.dumps({"error": "Missing quizId"})
        }
    
    try:
        print(f"Attempting DynamoDB get_item with Key: userId={user_id}, quizId={quiz_id}")
        response = table.get_item(Key={"userId": user_id, "quizId": quiz_id})
        print(f"DynamoDB response: {json.dumps(response, default=str)}")
        
        item = response.get("Item")
        
        if not item:
            print("Item not found in DynamoDB response")
            return {
                "statusCode": 404,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                },
                "body": json.dumps({"error": "Quiz not found"})
            }
        
        print("Successfully retrieved quiz item")
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            "body": json.dumps(item, default=str)
        }
        
    except Exception as e:
        print(f"Error getting quiz: {str(e)}")
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