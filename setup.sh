#!/bin/bash
# setup.sh - Create LocalStack backend + create/update Lambda functions from lambdas/*
set -euo pipefail
IFS=$'\n\t'

echo "🚀 Full LocalStack backend wiring (zips lambdas + create/update functions)"

# env
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
LS_ENDPOINT="http://localhost:4566"


export AWS_PAGER=""


# Lambda / folder mapping (function name -> folder name)
declare -A LAMBDAS=(
  [requestQuiz]="backend/lambdas/request_quiz"
  [generateQuiz]="backend/lambdas/generate_quiz"
  [getQuiz]="backend/lambdas/get_quiz"
  [submitAnswer]="backend/lambdas/submit_answer"
  [getPastQuizzes]="backend/lambdas/past_quizzes"
  [getPastQuiz]="backend/lambdas/past_quiz"
  [getOutstandingQuizzes]="backend/lambdas/outstanding_quizzes"
)

LAMBDA_ROLE="arn:aws:iam::000000000000:role/lambda-role"
RUNTIME="python3.9"
HANDLER="handler.handler"

# Helpers
aws_cli() {
  aws --endpoint-url="$LS_ENDPOINT" "$@"
}

echo "🔍 Checking LocalStack..."
if ! curl -s "$LS_ENDPOINT/health" >/dev/null; then
  echo "❌ LocalStack not running. Starting with docker-compose..."
  docker-compose up -d localstack
  echo "⏳ Waiting for LocalStack to be ready..."
  sleep 10
fi
echo ""
echo "✅ LocalStack should be ready."

# 1) Zip lambda folders into function.zip WITH dependencies
echo "📦 Creating function.zip for lambda folders with dependencies..."
for fname in "${!LAMBDAS[@]}"; do
  dir="${LAMBDAS[$fname]}"
  if [ -d "$dir" ]; then
    echo "→ Building $dir -> $dir/function.zip"
    (
      cd "$dir"
      # Remove old zip if exists
      [ -f function.zip ] && rm -f function.zip
      
      # Install dependencies if requirements.txt exists
      if [ -f requirements.txt ]; then
        echo "  Installing dependencies from requirements.txt..."
        pip install -r requirements.txt -t . --quiet
      fi
      
      # Create zip excluding unnecessary files
      zip -r -q function.zip . \
        -x "*/function.zip" \
        -x "*/__pycache__/*" \
        -x "*.pyc" \
        -x "*/.DS_Store" || true
    )
  else
    echo "⚠️  Missing directory for $fname: $dir (skipping zip for this function)"
  fi
done

# 2) Create DynamoDB tables
echo "🗄️  Creating DynamoDB tables (idempotent)..."
aws_cli dynamodb create-table \
  --table-name Quizzes \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=quizId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH AttributeName=quizId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST 2>/dev/null || echo "→ Quizzes table exists"

aws_cli dynamodb create-table \
  --table-name Results \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=quizId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH AttributeName=quizId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST 2>/dev/null || echo "→ Results table exists"

# 3) Create SQS queue
echo "📬 Creating / fetching SQS queue..."
QUEUE_URL=$(aws_cli sqs create-queue --queue-name quiz-generation-queue --query QueueUrl --output text 2>/dev/null || aws_cli sqs get-queue-url --queue-name quiz-generation-queue --query QueueUrl --output text)
QUEUE_ARN=$(aws_cli sqs get-queue-attributes --queue-url "$QUEUE_URL" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)
echo "→ Queue URL: $QUEUE_URL"
echo "→ Queue ARN: $QUEUE_ARN"

# Set SQS visibility timeout to match generateQuiz Lambda timeout
aws_cli sqs set-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --attributes VisibilityTimeout=300
echo "→ Set queue visibility timeout to 300s"


# 4) Create SNS topic
echo "📢 Creating / fetching SNS topic..."
TOPIC_ARN=$(aws_cli sns create-topic --name QuizResultsTopic --query TopicArn --output text 2>/dev/null || aws_cli sns list-topics --query "Topics[?contains(TopicArn, 'QuizResultsTopic')].TopicArn | [0]" --output text)
echo "→ Topic ARN: $TOPIC_ARN"

# 5) Create or update Lambda functions
echo "⚡ Creating or updating Lambda functions..."
create_or_update_lambda() {
  local fn_name="$1"
  local dir="$2"
  local zipfile="$dir/function.zip"

  # Ensure zip exists
  if [ ! -f "$zipfile" ]; then
    echo "❌ function.zip missing for $fn_name at $zipfile. Skipping."
    return 1
  fi

  # Set timeout based on function - generateQuiz needs more time for AI calls
  local timeout=30
  if [ "$fn_name" = "generateQuiz" ]; then
    timeout=300  # 5 minutes for AI generation
  fi

  # Build environment variables for this lambda
  # Don't set AWS_ENDPOINT for Lambda functions - let LocalStack handle it
  ENV_VARS=""
  
  # Add per-function envs
  case "$fn_name" in
    requestQuiz)
      ENV_VARS="QUEUE_URL=$QUEUE_URL"
      ;;
    generateQuiz)
      ENV_VARS="OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}"
      ;;
    submitAnswer)
      ENV_VARS="SNS_TOPIC=$TOPIC_ARN"
      ;;
    *) 
      ENV_VARS=""
      ;;
  esac

  # If function exists -> update code + config, else create
  if aws_cli lambda get-function --function-name "$fn_name" >/dev/null 2>&1; then
    echo "→ Updating existing Lambda: $fn_name"
    aws_cli lambda update-function-code --function-name "$fn_name" --zip-file "fileb://$zipfile" >/dev/null
    # update configuration (env and timeout)
    if [ -n "$ENV_VARS" ]; then
      aws_cli lambda update-function-configuration --function-name "$fn_name" --environment "Variables={$ENV_VARS}" --timeout "$timeout" >/dev/null || true
    else
      aws_cli lambda update-function-configuration --function-name "$fn_name" --timeout "$timeout" >/dev/null || true
    fi
    # wait briefly for update to propagate
    sleep 1
    echo "→ Updated $fn_name (timeout: ${timeout}s)"
  else
    echo "→ Creating Lambda: $fn_name"
    if [ -n "$ENV_VARS" ]; then
      aws_cli lambda create-function \
        --function-name "$fn_name" \
        --runtime "$RUNTIME" \
        --handler "$HANDLER" \
        --zip-file "fileb://$zipfile" \
        --role "$LAMBDA_ROLE" \
        --timeout "$timeout" \
        --environment "Variables={$ENV_VARS}" >/dev/null
    else
      aws_cli lambda create-function \
        --function-name "$fn_name" \
        --runtime "$RUNTIME" \
        --handler "$HANDLER" \
        --zip-file "fileb://$zipfile" \
        --role "$LAMBDA_ROLE" \
        --timeout "$timeout" >/dev/null
    fi
    # wait briefly
    sleep 1
    echo "→ Created $fn_name (timeout: ${timeout}s)"
  fi
}

# iterate and create/update
for fn in "${!LAMBDAS[@]}"; do
  create_or_update_lambda "$fn" "${LAMBDAS[$fn]}" || true
done

# 6) Fetch function ARNs (fresh)
get_lambda_arn() {
  local name="$1"
  aws_cli lambda get-function --function-name "$name" --query 'Configuration.FunctionArn' --output text 2>/dev/null || echo ""
}
ARN_REQUEST=$(get_lambda_arn "requestQuiz")
ARN_GENERATE=$(get_lambda_arn "generateQuiz")
ARN_GET=$(get_lambda_arn "getQuiz")
ARN_SUBMIT=$(get_lambda_arn "submitAnswer")
ARN_PAST_QUIZZES=$(get_lambda_arn "getPastQuizzes")
ARN_PAST_QUIZ=$(get_lambda_arn "getPastQuiz")
ARN_OUTSTANDING=$(get_lambda_arn "getOutstandingQuizzes")

for pair in "requestQuiz:$ARN_REQUEST" "generateQuiz:$ARN_GENERATE" "getQuiz:$ARN_GET" "submitAnswer:$ARN_SUBMIT" "getPastQuizzes:$ARN_PAST_QUIZZES" "getPastQuiz:$ARN_PAST_QUIZ" "getOutstandingQuizzes:$ARN_OUTSTANDING"; do
  name="${pair%%:*}"
  arn="${pair#*:}"
  if [ -z "$arn" ] || [ "$arn" = "None" ]; then
    echo "⚠️  Lambda NOT found in LocalStack: $name"
  else
    echo "✅ Lambda present: $name → $arn"
  fi
done

# 7) SQS -> generateQuiz mapping
if [ -n "$ARN_GENERATE" ]; then
  echo "🔗 Ensuring SQS -> generateQuiz mapping exists..."
  existing=$(aws_cli lambda list-event-source-mappings --function-name "generateQuiz" --query "EventSourceMappings[?EventSourceArn=='$QUEUE_ARN'].UUID" --output text 2>/dev/null || echo "")
  if [ -z "$existing" ]; then
    aws_cli lambda create-event-source-mapping --function-name "generateQuiz" --event-source-arn "$QUEUE_ARN" --batch-size 1 >/dev/null
    echo "→ Created mapping"
  else
    echo "→ Mapping already exists"
  fi
else
  echo "⚠️  generateQuiz lambda ARN missing — skipped SQS mapping."
fi

# 8) API Gateway: create API + resources + integrations for available lambdas
echo "🌐 Creating API Gateway (lightweight)..."
API_NAME="quiz-api"
API_ID=$(aws_cli apigateway create-rest-api --name "$API_NAME" --query 'id' --output text 2>/dev/null || aws_cli apigateway get-rest-apis --query "items[?name=='$API_NAME'].id | [0]" --output text)
ROOT_ID=$(aws_cli apigateway get-resources --rest-api-id "$API_ID" --query 'items[0].id' --output text)

create_resource() {
  local rest_api_id="$1" parent_id="$2" path_part="$3"
  aws_cli apigateway create-resource --rest-api-id "$rest_api_id" --parent-id "$parent_id" --path-part "$path_part" --query 'id' --output text 2>/dev/null || \
    aws_cli apigateway get-resources --rest-api-id "$rest_api_id" --query "items[?path=='/${path_part}'].id | [0]" --output text
}

# /quiz (POST)
QUIZ_RESOURCE=$(create_resource "$API_ID" "$ROOT_ID" "quiz")
aws_cli apigateway put-method --rest-api-id "$API_ID" --resource-id "$QUIZ_RESOURCE" --http-method POST --authorization-type "NONE" 2>/dev/null || true
if [ -n "$ARN_REQUEST" ]; then
  aws_cli apigateway put-integration --rest-api-id "$API_ID" --resource-id "$QUIZ_RESOURCE" --http-method POST --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/$ARN_REQUEST/invocations" >/dev/null
  echo "→ POST /quiz -> requestQuiz"
else
  echo "⚠️  requestQuiz not integrated (missing)"
fi

# CORS OPTIONS for /quiz
aws_cli apigateway put-method --rest-api-id "$API_ID" --resource-id "$QUIZ_RESOURCE" --http-method OPTIONS --authorization-type "NONE" 2>/dev/null || true
aws_cli apigateway put-integration --rest-api-id "$API_ID" --resource-id "$QUIZ_RESOURCE" --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\":200}"}' 2>/dev/null || true
aws_cli apigateway put-method-response --rest-api-id "$API_ID" --resource-id "$QUIZ_RESOURCE" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' 2>/dev/null || true
aws_cli apigateway put-integration-response --rest-api-id "$API_ID" --resource-id "$QUIZ_RESOURCE" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'\''Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'\''","method.response.header.Access-Control-Allow-Methods":"'\''POST,OPTIONS'\''","method.response.header.Access-Control-Allow-Origin":"'\''*'\''"}' --response-templates '{"application/json":""}' 2>/dev/null || true

# /quiz/{quizId} (GET)
QUIZ_ID_RESOURCE=$(aws_cli apigateway create-resource --rest-api-id "$API_ID" --parent-id "$QUIZ_RESOURCE" --path-part "{quizId}" --query 'id' --output text 2>/dev/null || aws_cli apigateway get-resources --rest-api-id "$API_ID" --query "items[?path=='/quiz/{quizId}'].id | [0]" --output text)
aws_cli apigateway put-method --rest-api-id "$API_ID" --resource-id "$QUIZ_ID_RESOURCE" --http-method GET --authorization-type "NONE" 2>/dev/null || true
if [ -n "$ARN_GET" ]; then
  aws_cli apigateway put-integration --rest-api-id "$API_ID" --resource-id "$QUIZ_ID_RESOURCE" --http-method GET --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/$ARN_GET/invocations" >/dev/null
  echo "→ GET /quiz/{quizId} -> getQuiz"
else
  echo "⚠️  getQuiz not integrated (missing)"
fi

# /submit (POST)
SUBMIT_RESOURCE=$(create_resource "$API_ID" "$ROOT_ID" "submit")
aws_cli apigateway put-method --rest-api-id "$API_ID" --resource-id "$SUBMIT_RESOURCE" --http-method POST --authorization-type "NONE" 2>/dev/null || true
if [ -n "$ARN_SUBMIT" ]; then
  aws_cli apigateway put-integration --rest-api-id "$API_ID" --resource-id "$SUBMIT_RESOURCE" --http-method POST --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/$ARN_SUBMIT/invocations" >/dev/null
  echo "→ POST /submit -> submitAnswer"
else
  echo "⚠️  submitAnswer not integrated (missing)"
fi

# /past-quizzes (GET)
PAST_QUIZZES_RESOURCE=$(create_resource "$API_ID" "$ROOT_ID" "past-quizzes")
aws_cli apigateway put-method --rest-api-id "$API_ID" --resource-id "$PAST_QUIZZES_RESOURCE" --http-method GET --authorization-type "NONE" 2>/dev/null || true
if [ -n "$ARN_PAST_QUIZZES" ]; then
  aws_cli apigateway put-integration --rest-api-id "$API_ID" --resource-id "$PAST_QUIZZES_RESOURCE" --http-method GET --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/$ARN_PAST_QUIZZES/invocations" >/dev/null
  echo "→ GET /past-quizzes -> getPastQuizzes"
else
  echo "⚠️  getPastQuizzes not integrated (missing)"
fi

# /past-quiz/{quizId} (GET)
PAST_QUIZ_RESOURCE=$(create_resource "$API_ID" "$ROOT_ID" "past-quiz")
PAST_QUIZ_ID_RESOURCE=$(aws_cli apigateway create-resource --rest-api-id "$API_ID" --parent-id "$PAST_QUIZ_RESOURCE" --path-part "{quizId}" --query 'id' --output text 2>/dev/null || aws_cli apigateway get-resources --rest-api-id "$API_ID" --query "items[?path=='/past-quiz/{quizId}'].id | [0]" --output text)
aws_cli apigateway put-method --rest-api-id "$API_ID" --resource-id "$PAST_QUIZ_ID_RESOURCE" --http-method GET --authorization-type "NONE" 2>/dev/null || true
if [ -n "$ARN_PAST_QUIZ" ]; then
  aws_cli apigateway put-integration --rest-api-id "$API_ID" --resource-id "$PAST_QUIZ_ID_RESOURCE" --http-method GET --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/$ARN_PAST_QUIZ/invocations" >/dev/null
  echo "→ GET /past-quiz/{quizId} -> getPastQuiz"
else
  echo "⚠️  getPastQuiz not integrated (missing)"
fi

# /outstanding-quizzes (GET)
OUTSTANDING_RESOURCE=$(create_resource "$API_ID" "$ROOT_ID" "outstanding-quizzes")
aws_cli apigateway put-method --rest-api-id "$API_ID" --resource-id "$OUTSTANDING_RESOURCE" --http-method GET --authorization-type "NONE" 2>/dev/null || true
if [ -n "$ARN_OUTSTANDING" ]; then
  aws_cli apigateway put-integration --rest-api-id "$API_ID" --resource-id "$OUTSTANDING_RESOURCE" --http-method GET --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/$ARN_OUTSTANDING/invocations" >/dev/null
  echo "→ GET /outstanding-quizzes -> getOutstandingQuizzes"
else
  echo "⚠️  getOutstandingQuizzes not integrated (missing)"
fi

# Deploy
echo "🚀 Deploying API..."
aws_cli apigateway create-deployment --rest-api-id "$API_ID" --stage-name dev >/dev/null

# Add Lambda invoke permissions (best-effort)
echo "🔑 Adding Lambda permissions (best-effort)..."
add_perm() {
  local fn="$1" sid="$2" src="$3"
  if [ -z "$fn" ]; then return; fi
  aws_cli lambda add-permission --function-name "$fn" --statement-id "$sid" --action "lambda:InvokeFunction" --principal apigateway.amazonaws.com --source-arn "$src" 2>/dev/null || true
}
add_perm "requestQuiz" apigw-requestQuiz "arn:aws:execute-api:us-east-1:000000000000:$API_ID/*/POST/quiz"
add_perm "getQuiz" apigw-getQuiz "arn:aws:execute-api:us-east-1:000000000000:$API_ID/*/GET/quiz/*"
add_perm "submitAnswer" apigw-submitAnswer "arn:aws:execute-api:us-east-1:000000000000:$API_ID/*/POST/submit"
add_perm "getPastQuizzes" apigw-getPastQuizzes "arn:aws:execute-api:us-east-1:000000000000:$API_ID/*/GET/past-quizzes"
add_perm "getPastQuiz" apigw-getPastQuiz "arn:aws:execute-api:us-east-1:000000000000:$API_ID/*/GET/past-quiz/*"
add_perm "getOutstandingQuizzes" apigw-getOutstandingQuizzes "arn:aws:execute-api:us-east-1:000000000000:$API_ID/*/GET/outstanding-quizzes"

# 9) Save endpoints
cat > api-endpoints.txt <<EOF
🎉 Setup Complete!

API ID: $API_ID
Request Quiz:         POST http://localhost:4566/restapis/$API_ID/dev/_user_request_/quiz
Get Quiz:             GET  http://localhost:4566/restapis/$API_ID/dev/_user_request_/quiz/{quizId}?userId=anonymous
Submit Quiz:          POST http://localhost:4566/restapis/$API_ID/dev/_user_request_/submit
Get Past Quizzes:     GET  http://localhost:4566/restapis/$API_ID/dev/_user_request_/past-quizzes?userId=anonymous
Get Past Quiz:        GET  http://localhost:4566/restapis/$API_ID/dev/_user_request_/past-quiz/{quizId}?userId=anonymous
Get Outstanding Quiz: GET  http://localhost:4566/restapis/$API_ID/dev/_user_request_/outstanding-quizzes?userId=anonymous

Notes:
- Lambda zip files created with dependencies installed from requirements.txt
- Lambdas were created/updated in LocalStack (where function code existed)
- SQS queue 'quiz-generation-queue' and SNS topic 'QuizResultsTopic' created
- generateQuiz timeout set to 300s (5 minutes) for AI generation
- If a lambda was missing its folder or zip, that function was skipped

Example test:
curl -X POST "http://localhost:4566/restapis/$API_ID/dev/_user_request_/quiz" -H "Content-Type: application/json" -d '{"userId":"testuser","topic":"JS","numQuestions":3}'

DynamoDB tables: Quizzes, Results
SQS queue: quiz-generation-queue
SNS topic: QuizResultsTopic
EOF

FE_ENV_FILE="frontend/.env"

if [ -d "frontend" ]; then
  if [ ! -f "$FE_ENV_FILE" ]; then
    # Create the file if it doesn't exist
    echo "NEXT_PUBLIC_API_ID=$API_ID" > "$FE_ENV_FILE"
    echo "✅ Created $FE_ENV_FILE with NEXT_PUBLIC_API_ID=$API_ID"
  elif grep -q "^NEXT_PUBLIC_API_ID=" "$FE_ENV_FILE"; then
    # Update existing line
    sed -i "s/^NEXT_PUBLIC_API_ID=.*/NEXT_PUBLIC_API_ID=$API_ID/" "$FE_ENV_FILE"
    echo "✅ Updated NEXT_PUBLIC_API_ID in $FE_ENV_FILE"
  else
    # Append new line carefully
    if [ -s "$FE_ENV_FILE" ]; then
      # File is not empty, ensure new line before appending
      echo "" >> "$FE_ENV_FILE"
    fi
    echo "NEXT_PUBLIC_API_ID=$API_ID" >> "$FE_ENV_FILE"
    echo "✅ Appended NEXT_PUBLIC_API_ID to $FE_ENV_FILE"
  fi
else
  echo "⚠️  Frontend directory not found at frontend. Skipped writing .env."
fi

echo "✅ Done. See api-endpoints.txt for endpoints and tests."
echo "🔍 Tail logs: docker logs localstack -f"