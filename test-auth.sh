#!/bin/bash

echo "Testing authentication..."
aws cognito-idp admin-initiate-auth \
  --user-pool-id us-east-1_LQ9dJW5iZ \
  --client-id 68lgnsmc8mrb0g15ap7jk1m43d \
  --auth-flow ADMIN_USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=admin@insightfuelflow.com,PASSWORD=AdminPass1 \
  --region us-east-1

echo ""
echo "Exit code: $?"
