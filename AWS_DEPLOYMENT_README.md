# AWS Deployment Guide for Insight Fuel Flow

This guide will help you deploy the complete AWS infrastructure for testing the full workflow.

## Prerequisites

1. **AWS Account**: You need an AWS account with appropriate permissions
2. **AWS CLI**: Install and configure AWS CLI
3. **Node.js**: Version 18+ recommended

## Step 1: Configure AWS CLI

```bash
# Install AWS CLI (if not already installed)
brew install awscli

# Configure AWS credentials
aws configure

# Enter your:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: us-east-1
# - Default output format: json
```

## Step 2: Deploy AWS Infrastructure

Run the automated deployment script:

```bash
./deploy-aws.sh
```

This will:
- Install dependencies
- Bootstrap CDK (first time only)
- Build the infrastructure
- Deploy all AWS stacks (API Gateway, Lambda, RDS, Cognito, S3)
- Display the deployment outputs

## Step 3: Initialize Database

After deployment, initialize the database schema:

```bash
./init-database.sh
```

This will create all the required tables, indexes, and initial data.

## Step 4: Create Admin User

Create an admin user for testing:

```bash
./create-admin.sh
```

This creates:
- Email: `admin@insightfuelflow.com`
- Password: `Admin123456!`

## Step 5: Update Frontend Configuration

The deployment script will output the required values. Update your frontend `.env` file:

```env
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=your-user-pool-id
VITE_COGNITO_CLIENT_ID=your-client-id
VITE_API_BASE_URL=your-api-gateway-url
VITE_S3_BUCKET=your-s3-bucket-name
```

## Step 6: Test the Full Workflow

1. **Login** as admin user
2. **Create a Deal** from a pin or manually
3. **Schedule Inspection** date
4. **Schedule Adjuster Meeting** date
5. **Mark as Signed** when contract is ready
6. **Order Materials** when signed
7. **Mark Materials Delivered** when arrived
8. **Schedule Install Date** (optional)
9. **Mark as Installed** when complete
10. **Mark as Complete** for final status

## Available Scripts

- `./deploy-aws.sh` - Deploy/update all AWS infrastructure
- `./init-database.sh` - Initialize database schema
- `./create-admin.sh` - Create admin user
- `./infrastructure/scripts/migrate-data.sh` - Migrate data from Supabase (if needed)

## Troubleshooting

### CDK Bootstrap Issues
If you get bootstrap errors, try:
```bash
cd infrastructure
cdk bootstrap --context stage=dev
```

### Permission Issues
Make sure your AWS user has these permissions:
- CloudFormation full access
- Lambda full access
- API Gateway full access
- RDS full access
- Cognito full access
- S3 full access
- IAM full access

### Database Connection Issues
If Lambda can't connect to RDS, check:
- Security groups allow Lambda to access RDS
- Database credentials in Secrets Manager are correct
- VPC configuration is correct

## Cost Estimation

Expected monthly costs for development environment:
- RDS PostgreSQL: ~$30/month
- Lambda: ~$5/month
- API Gateway: ~$5/month
- Cognito: ~$1/month
- S3: ~$1/month
- CloudFormation: Free

**Total: ~$42/month** for development testing

## Production Deployment

For production, use:
```bash
cd infrastructure
cdk deploy --all --context stage=prod
```

Make sure to update the `.env` file with production values.
