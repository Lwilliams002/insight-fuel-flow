# AWS Migration Summary

This document summarizes all the files and changes made for migrating from Supabase to AWS.

## Files Created

### Infrastructure (CDK)

| File | Purpose |
|------|---------|
| `infrastructure/package.json` | CDK project dependencies |
| `infrastructure/tsconfig.json` | TypeScript configuration for CDK |
| `infrastructure/cdk.json` | CDK configuration |
| `infrastructure/README.md` | Infrastructure documentation |
| `infrastructure/bin/infrastructure.ts` | CDK app entry point |
| `infrastructure/lib/auth-stack.ts` | Cognito User Pool stack |
| `infrastructure/lib/database-stack.ts` | RDS PostgreSQL + VPC stack |
| `infrastructure/lib/storage-stack.ts` | S3 bucket stack |
| `infrastructure/lib/api-stack.ts` | API Gateway + Lambda stack |

### Lambda Functions

| File | Purpose |
|------|---------|
| `infrastructure/lambda/shared/database.ts` | Database connection utilities |
| `infrastructure/lambda/shared/auth.ts` | Auth helpers and response utilities |
| `infrastructure/lambda/deals/index.ts` | Deals CRUD operations |
| `infrastructure/lambda/reps/index.ts` | Reps management |
| `infrastructure/lambda/pins/index.ts` | Location pins CRUD |
| `infrastructure/lambda/commissions/index.ts` | Commissions tracking |
| `infrastructure/lambda/upload/index.ts` | S3 presigned URL generation |
| `infrastructure/lambda/admin/index.ts` | Admin operations (create users) |

### Migration Scripts

| File | Purpose |
|------|---------|
| `infrastructure/scripts/migrate-data.sh` | Export Supabase data → Import to RDS |
| `infrastructure/scripts/migrate-users.sh` | Migrate Supabase Auth users to Cognito |

### Frontend AWS Integration

| File | Purpose |
|------|---------|
| `src/integrations/aws/config.ts` | AWS configuration (env variables) |
| `src/integrations/aws/auth.ts` | Cognito authentication functions |
| `src/integrations/aws/api.ts` | API client for all endpoints |
| `src/integrations/aws/index.ts` | Re-exports all AWS functions |
| `src/contexts/AwsAuthContext.tsx` | React context for AWS auth |

### Configuration

| File | Purpose |
|------|---------|
| `.env.aws.example` | Example environment variables for AWS |

## Dependencies Added

### Frontend (package.json)
- `amazon-cognito-identity-js` - Cognito SDK for browser

### Infrastructure (infrastructure/package.json)
- `aws-cdk-lib` - AWS CDK
- `pg` - PostgreSQL client for Lambda
- `@aws-sdk/client-secrets-manager` - Secrets Manager SDK
- `@aws-sdk/client-s3` - S3 SDK
- `@aws-sdk/s3-request-presigner` - S3 presigned URLs
- `@aws-sdk/client-cognito-identity-provider` - Cognito admin SDK

## Migration Steps

### 1. Deploy AWS Infrastructure

```bash
cd infrastructure
npm install
cdk bootstrap  # First time only
cdk deploy --all --context stage=dev
```

### 2. Migrate Database

```bash
cd infrastructure/scripts
export SUPABASE_HOST=db.your-project.supabase.co
export SUPABASE_PASSWORD=your-password
export RDS_HOST=your-rds-endpoint.rds.amazonaws.com
export RDS_PASSWORD=your-rds-password
./migrate-data.sh
```

### 3. Migrate Users

```bash
export USER_POOL_ID=us-east-1_xxxxxxxxx
./migrate-users.sh
```

### 4. Update Frontend Environment

Create `.env` with values from CDK output:
```env
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=<from-cdk-output>
VITE_COGNITO_USER_POOL_CLIENT_ID=<from-cdk-output>
VITE_API_URL=<from-cdk-output>
VITE_S3_BUCKET=<from-cdk-output>
```

### 5. Switch Auth Provider

In `src/main.tsx`, replace:
```tsx
import { AuthProvider } from '@/contexts/AuthContext';
// with
import { AwsAuthProvider } from '@/contexts/AwsAuthContext';
```

### 6. Update API Calls

Replace Supabase calls with AWS API calls:
```tsx
// Before
const { data } = await supabase.from('deals').select('*');

// After
import { dealsApi } from '@/integrations/aws';
const { data } = await dealsApi.list();
```

## Rollback

To rollback, simply switch back to the Supabase environment variables and AuthProvider. The AWS infrastructure can be destroyed with:

```bash
cd infrastructure
cdk destroy --all
```

## Cost Estimate

| Service | Monthly Cost (Dev) |
|---------|-------------------|
| RDS t3.micro | ~$15-25 |
| Lambda | Free tier |
| API Gateway | ~$3-5 |
| Cognito | Free tier (< 50k MAU) |
| S3 | ~$1-5 |
| **Total** | **~$20-40** |

Production with Multi-AZ RDS and higher instance types will cost more.
