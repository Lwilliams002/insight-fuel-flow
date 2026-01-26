#!/bin/bash

# AWS Infrastructure Deployment Script for Insight Fuel Flow
# Run this after configuring AWS CLI with 'aws configure'

set -e

echo "🚀 Starting AWS Infrastructure Deployment for Insight Fuel Flow"
echo "============================================================"

cd /Users/lezdev/Desktop/Williams/insight-fuel-flow/infrastructure

# Check AWS CLI configuration
echo ""
echo "1. Checking AWS CLI configuration..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ AWS CLI configured successfully"

# Install dependencies
echo ""
echo "2. Installing dependencies..."
npm install

# Bootstrap CDK (if not already done)
echo ""
echo "3. Bootstrapping CDK..."
cdk bootstrap --context stage=dev || echo "CDK already bootstrapped"

# Build the infrastructure
echo ""
echo "4. Building infrastructure code..."
npm run build

# Deploy all stacks
echo ""
echo "5. Deploying AWS infrastructure..."
echo "This may take 15-20 minutes..."
cdk deploy --all --context stage=dev --require-approval never

# Get outputs
echo ""
echo "6. Getting deployment outputs..."
API_URL=$(cdk describe-stack InsightFuelFlow-Api-dev | grep -A 5 "Outputs" | grep "ApiGatewayUrl" | cut -d'"' -f4 || echo "")
USER_POOL_ID=$(cdk describe-stack InsightFuelFlow-Auth-dev | grep -A 5 "Outputs" | grep "CognitoUserPoolId" | cut -d'"' -f4 || echo "")
USER_POOL_CLIENT_ID=$(cdk describe-stack InsightFuelFlow-Auth-dev | grep -A 5 "Outputs" | grep "CognitoUserPoolClientId" | cut -d'"' -f4 || echo "")
BUCKET_NAME=$(cdk describe-stack InsightFuelFlow-Storage-dev | grep -A 5 "Outputs" | grep "S3BucketName" | cut -d'"' -f4 || echo "")

echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo ""
echo "API Gateway URL: $API_URL"
echo "Cognito User Pool ID: $USER_POOL_ID"
echo "Cognito Client ID: $USER_POOL_CLIENT_ID"
echo "S3 Bucket: $BUCKET_NAME"
echo ""
echo "📝 Next Steps:"
echo "1. Update your frontend .env file with these values"
echo "2. Run the database initialization Lambda to create tables"
echo "3. Test the full workflow!"
echo ""
echo "To initialize the database, you can call the init-db Lambda or run:"
echo "aws lambda invoke --function-name InsightFuelFlow-InitDb-dev response.json"
