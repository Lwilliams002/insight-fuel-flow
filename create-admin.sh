#!/bin/bash
set -e

echo "=== Creating Admin User ==="

# Get the User Pool ID from CloudFormation outputs
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name InsightFuelFlow-Auth-dev --query 'Stacks[0].Outputs[?OutputKey==`CognitoUserPoolId`].OutputValue' --output text 2>/dev/null)

if [ -z "$USER_POOL_ID" ]; then
    echo "❌ Could not find User Pool ID. Make sure the Auth stack is deployed."
    echo "Run ./deploy-aws.sh first."
    exit 1
fi

echo "Found User Pool ID: $USER_POOL_ID"

# Step 1: Create user
echo "Step 1: Creating user..."
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@insightfuelflow.com \
  --user-attributes Name=email,Value=admin@insightfuelflow.com Name=email_verified,Value=true \
  --temporary-password TempPass123! \
  --message-action SUPPRESS \
  --region us-east-1 2>/dev/null || echo "  (User may already exist)"

# Step 2: Set permanent password
echo "Step 2: Setting permanent password..."
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username admin@insightfuelflow.com \
  --password Admin123456! \
  --permanent \
  --region us-east-1

# Step 3: Add to admin group
echo "Step 3: Adding to admin group..."
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username admin@insightfuelflow.com \
  --group-name admin \
  --region us-east-1

echo ""
echo "=== SUCCESS ==="
echo ""
echo "Login credentials:"
echo "  Email: admin@insightfuelflow.com"
echo "  Password: Admin123456!"
echo ""
