# AWS Setup Guide - Step by Step

Follow these steps to connect your AWS account to the project.

## Step 1: Install AWS CLI

Open your terminal and run:

```bash
brew install awscli
```

Verify installation:
```bash
aws --version
```

## Step 2: Create IAM User for CLI Access

1. **Go to AWS Console**: https://console.aws.amazon.com/
2. **Navigate to IAM**: Search for "IAM" in the top search bar
3. **Create a new user**:
   - Click "Users" in the left sidebar
   - Click "Create user"
   - Username: `insight-fuel-flow-admin`
   - Click "Next"
4. **Set permissions**:
   - Select "Attach policies directly"
   - Search and check: `AdministratorAccess` (for initial setup, can be restricted later)
   - Click "Next" → "Create user"
5. **Create access keys**:
   - Click on the new user
   - Go to "Security credentials" tab
   - Click "Create access key"
   - Select "Command Line Interface (CLI)"
   - Check the acknowledgment box
   - Click "Create access key"
   - **SAVE** the Access Key ID and Secret Access Key (you won't see the secret again!)

## Step 3: Configure AWS CLI

Run this command and enter your credentials:

```bash
aws configure
```

Enter when prompted:
- **AWS Access Key ID**: (paste your access key)
- **AWS Secret Access Key**: (paste your secret key)
- **Default region name**: `us-east-1` (or your preferred region)
- **Default output format**: `json`

Verify configuration:
```bash
aws sts get-caller-identity
```

You should see output like:
```json
{
    "UserId": "AIDXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/insight-fuel-flow-admin"
}
```

## Step 4: Install AWS CDK

```bash
npm install -g aws-cdk
```

Verify:
```bash
cdk --version
```

## Step 5: Bootstrap CDK (First Time Only)

This creates necessary resources in your AWS account for CDK:

```bash
cd /Users/lezdev/Desktop/Williams/insight-fuel-flow/infrastructure
npm install
cdk bootstrap
```

## Step 6: Deploy Infrastructure

Deploy all stacks to AWS:

```bash
cd /Users/lezdev/Desktop/Williams/insight-fuel-flow/infrastructure
cdk deploy --all --context stage=dev
```

When prompted "Do you wish to deploy these changes?", type `y` and press Enter.

**Note down the outputs!** They will look like:

```
Outputs:
InsightFuelFlow-Auth-dev.CognitoUserPoolId = us-east-1_XXXXXXXX
InsightFuelFlow-Auth-dev.CognitoUserPoolClientId = XXXXXXXXXXXXXXXXXX
InsightFuelFlow-Api-dev.ApiUrl = https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/dev
InsightFuelFlow-Storage-dev.BucketName = insightfuelflow-storage-dev-XXXXX
```

## Step 7: Update Frontend Environment

Create/update the `.env` file in the project root:

```bash
cd /Users/lezdev/Desktop/Williams/insight-fuel-flow

cat > .env << 'EOF'
# AWS Configuration
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=<paste-user-pool-id>
VITE_COGNITO_USER_POOL_CLIENT_ID=<paste-client-id>
VITE_API_URL=<paste-api-url>
VITE_S3_BUCKET=<paste-bucket-name>

# Keep Supabase for now (during migration)
VITE_SUPABASE_URL=your-current-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-current-supabase-key
EOF
```

## Step 8: Migrate Data (After Infrastructure is Deployed)

### Get your RDS endpoint:
```bash
aws rds describe-db-instances --query 'DBInstances[*].[DBInstanceIdentifier,Endpoint.Address]' --output table
```

### Run data migration:
```bash
cd /Users/lezdev/Desktop/Williams/insight-fuel-flow/infrastructure/scripts

# Set environment variables
export SUPABASE_HOST=db.your-project.supabase.co
export SUPABASE_PASSWORD=your-supabase-password
export RDS_HOST=your-rds-endpoint.rds.amazonaws.com
export RDS_PASSWORD=your-rds-password  # Get from Secrets Manager

./migrate-data.sh
```

## Step 9: Create Initial Admin User

After deployment, create your first admin user:

```bash
# Get your User Pool ID from the deployment outputs
USER_POOL_ID=us-east-1_XXXXXXXX

# Create admin user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@yourdomain.com \
  --user-attributes Name=email,Value=admin@yourdomain.com Name=email_verified,Value=true \
  --temporary-password "TempPass123!"

# Add to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username admin@yourdomain.com \
  --group-name admin
```

## Troubleshooting

### "No credentials" error
```bash
aws configure list  # Check current config
aws sts get-caller-identity  # Test credentials
```

### CDK bootstrap failed
```bash
cdk bootstrap aws://ACCOUNT_ID/REGION
# Replace ACCOUNT_ID with your 12-digit account number
# Replace REGION with your region (e.g., us-east-1)
```

### View deployment logs
```bash
cdk deploy --all --context stage=dev --verbose
```

### Destroy everything (start over)
```bash
cdk destroy --all
```

## Cost Alert

Set up a billing alert to avoid surprises:

1. Go to AWS Console → Billing → Budgets
2. Create a budget → Cost budget
3. Set monthly amount (e.g., $50)
4. Add email notification at 80% threshold

## Next Steps

After successful deployment:
1. Test the API endpoints
2. Switch frontend to use AWS auth
3. Migrate production data
4. Set up CI/CD (optional)
