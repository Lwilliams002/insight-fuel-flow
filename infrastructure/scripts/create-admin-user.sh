#!/bin/bash

echo "=== Creating Admin User ==="

# Create admin user
/usr/local/bin/aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_LQ9dJW5iZ \
  --username "admin@insightfuelflow.com" \
  --user-attributes Name=email,Value=admin@insightfuelflow.com Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS \
  --output json

echo "=== Setting Permanent Password ==="

# Set permanent password
/usr/local/bin/aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_LQ9dJW5iZ \
  --username "admin@insightfuelflow.com" \
  --password "Admin@123456" \
  --permanent

echo "=== Adding to Admin Group ==="

# Add to admin group
/usr/local/bin/aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_LQ9dJW5iZ \
  --username "admin@insightfuelflow.com" \
  --group-name admin

echo "=== Done ==="
echo ""
echo "Admin user created:"
echo "Email: admin@insightfuelflow.com"
echo "Password: Admin@123456"
