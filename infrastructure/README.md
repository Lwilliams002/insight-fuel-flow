# AWS Infrastructure for Insight Fuel Flow

This directory contains the AWS CDK infrastructure code for deploying the application to AWS.

## Prerequisites

1. **AWS CLI**: Install and configure with your credentials
   ```bash
   brew install awscli
   aws configure
   ```

2. **AWS CDK**: Install the CDK CLI globally
   ```bash
   npm install -g aws-cdk
   ```

3. **Node.js**: Version 18+ recommended

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Amazon CloudFront                          │
│                    (CDN for React Frontend)                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────────┐
        ▼                           ▼                               ▼
┌───────────────┐          ┌───────────────┐              ┌───────────────┐
│   S3 Bucket   │          │  API Gateway  │              │   Cognito     │
│  (Frontend)   │          │   (REST API)  │              │  User Pool    │
└───────────────┘          └───────┬───────┘              │  (Auth)       │
                                   │                      └───────────────┘
                                   ▼
                           ┌───────────────┐
                           │    Lambda     │
                           │  Functions    │
                           └───────┬───────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│      RDS      │          │      S3       │          │   Secrets     │
│  PostgreSQL   │          │   (Storage)   │          │   Manager     │
└───────────────┘          └───────────────┘          └───────────────┘
```

## AWS Services Used

| Supabase Feature | AWS Replacement |
|-----------------|-----------------|
| Authentication | Amazon Cognito |
| PostgreSQL Database | Amazon RDS PostgreSQL |
| Edge Functions | AWS Lambda + API Gateway |
| Storage | Amazon S3 |
| Realtime | AWS AppSync (optional) or WebSocket API |

## Setup Instructions

### 1. Initialize CDK (First time only)

```bash
cd infrastructure
npm install
cdk bootstrap
```

### 2. Deploy the Stack

```bash
# Deploy to development
cdk deploy --all --context stage=dev

# Deploy to production
cdk deploy --all --context stage=prod
```

### 3. After Deployment

The CDK will output the following values you'll need for the frontend:
- `CognitoUserPoolId`
- `CognitoUserPoolClientId`
- `ApiGatewayUrl`
- `S3BucketName`

Update your `.env` file with these values.

## Database Migration

### Export from Supabase

1. Go to Supabase Dashboard → Database → Backups
2. Download the latest backup, or use pg_dump:
   ```bash
   pg_dump -h db.YOUR_PROJECT.supabase.co -U postgres -d postgres > supabase_backup.sql
   ```

### Import to RDS

```bash
psql -h YOUR_RDS_ENDPOINT -U postgres -d insightfuelflow < supabase_backup.sql
```

## Environment Variables

Create a `.env` file in the infrastructure directory:

```env
AWS_ACCOUNT_ID=your-account-id
AWS_REGION=us-east-1
DOMAIN_NAME=your-domain.com (optional)
MAPBOX_TOKEN=your-mapbox-token
```

## Useful Commands

- `cdk diff` - Compare deployed stack with current state
- `cdk synth` - Emit the synthesized CloudFormation template
- `cdk destroy` - Remove all deployed resources
