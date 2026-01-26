#!/bin/bash

# Database Initialization Script
# Run this after deploying the AWS infrastructure

set -e

echo "🗄️  Initializing Database Schema"
echo "================================"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Invoke the init-db Lambda function
echo "Invoking init-db Lambda function..."
aws lambda invoke \
  --function-name InsightFuelFlow-InitDb-dev \
  --payload '{}' \
  response.json

echo "✅ Database initialization complete!"
echo "Response saved to response.json"

# Check the response
if [ -f response.json ]; then
    echo "Lambda response:"
    cat response.json
fi

echo ""
echo "🎯 Next: Create an admin user with the create-admin.sh script"
