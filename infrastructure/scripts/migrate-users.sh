#!/bin/bash

# User Migration Script: Supabase Auth to AWS Cognito
# This script migrates user accounts from Supabase to Cognito

set -e

echo "=========================================="
echo "User Migration: Supabase to Cognito"
echo "=========================================="

# Configuration
SUPABASE_HOST="${SUPABASE_HOST:-db.your-project.supabase.co}"
SUPABASE_DB="${SUPABASE_DB:-postgres}"
SUPABASE_USER="${SUPABASE_USER:-postgres}"
SUPABASE_PASSWORD="${SUPABASE_PASSWORD:-}"

USER_POOL_ID="${USER_POOL_ID:-us-east-1_xxxxxxxxx}"
AWS_REGION="${AWS_REGION:-us-east-1}"

BACKUP_DIR="./migration_backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
USERS_FILE="${BACKUP_DIR}/users_${TIMESTAMP}.json"

mkdir -p "$BACKUP_DIR"

echo ""
echo "Step 1: Exporting users from Supabase..."
echo "----------------------------------------"

# Export users with their roles
PGPASSWORD="$SUPABASE_PASSWORD" psql \
  -h "$SUPABASE_HOST" \
  -U "$SUPABASE_USER" \
  -d "$SUPABASE_DB" \
  -t -A -c "
    SELECT json_agg(row_to_json(u))
    FROM (
      SELECT
        au.id,
        au.email,
        p.full_name,
        ur.role,
        au.created_at
      FROM auth.users au
      LEFT JOIN public.profiles p ON p.id = au.id
      LEFT JOIN public.user_roles ur ON ur.user_id = au.id
      WHERE au.email IS NOT NULL
    ) u
  " > "$USERS_FILE"

USER_COUNT=$(cat "$USERS_FILE" | jq 'length')
echo "✅ Exported $USER_COUNT users to: $USERS_FILE"

echo ""
echo "Step 2: Creating users in Cognito..."
echo "------------------------------------"

# Read and process each user
cat "$USERS_FILE" | jq -c '.[]' | while read -r user; do
  email=$(echo "$user" | jq -r '.email')
  full_name=$(echo "$user" | jq -r '.full_name // .email')
  role=$(echo "$user" | jq -r '.role // "rep"')

  echo "Creating user: $email (role: $role)"

  # Create user in Cognito
  aws cognito-idp admin-create-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$email" \
    --user-attributes \
      Name=email,Value="$email" \
      Name=email_verified,Value=true \
      Name=name,Value="$full_name" \
    --message-action SUPPRESS \
    --region "$AWS_REGION" \
    2>/dev/null || echo "  ⚠️  User may already exist"

  # Add to appropriate group
  aws cognito-idp admin-add-user-to-group \
    --user-pool-id "$USER_POOL_ID" \
    --username "$email" \
    --group-name "$role" \
    --region "$AWS_REGION" \
    2>/dev/null || echo "  ⚠️  Could not add to group"

  echo "  ✅ Created $email"
done

echo ""
echo "=========================================="
echo "User Migration Complete!"
echo "=========================================="
echo ""
echo "IMPORTANT: Users will need to reset their passwords!"
echo ""
echo "Options:"
echo "1. Send password reset emails to all users"
echo "2. Set temporary passwords and force change on first login"
echo ""
echo "To send password reset emails, run:"
echo "  aws cognito-idp admin-reset-user-password --user-pool-id $USER_POOL_ID --username <email>"
echo ""
