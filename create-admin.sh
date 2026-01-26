#!/bin/bash
set -e

echo "=== Creating Admin User ==="

# Step 1: Create user
echo "Step 1: Creating user..."
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_LQ9dJW5iZ \
  --username admin@insightfuelflow.com \
  --user-attributes Name=email,Value=admin@insightfuelflow.com Name=email_verified,Value=true \
  --temporary-password TempPass123! \
  --message-action SUPPRESS \
  --region us-east-1 2>/dev/null || echo "  (User may already exist)"

# Step 2: Set permanent password
echo "Step 2: Setting permanent password..."
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_LQ9dJW5iZ \
  --username admin@insightfuelflow.com \
  --password Admin123456! \
  --permanent \
  --region us-east-1

# Step 3: Add to admin group
echo "Step 3: Adding to admin group..."
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_LQ9dJW5iZ \
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
