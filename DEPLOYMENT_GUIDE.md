# Learning Dashboard Deployment Guide

This guide covers deploying the Learning Dashboard feature to AWS.

## Prerequisites

- AWS account with CDK configured
- AWS CLI installed and configured
- Node.js 18+ installed
- CDK CLI installed globally (`npm install -g aws-cdk`)

## What's New

The Learning Dashboard adds:
1. **New Lambda Function**: `training` - handles training progress and exam submissions
2. **Database Changes**: 
   - New `training_progress` table
   - New `training_completed` column in `reps` table
   - New enum values: `renter` and `not_interested` for `pin_status`
3. **API Routes**:
   - `GET /training` - Get rep's training progress
   - `POST /training/submit` - Submit exam answers

## Step-by-Step Deployment

### 1. Install Infrastructure Dependencies

```bash
cd infrastructure
npm install
```

### 2. Deploy CDK Stack

The training Lambda function and API routes are now included in the CDK stack.

```bash
# Deploy to dev
cdk deploy --all --context stage=dev

# Or deploy to prod
cdk deploy --all --context stage=prod
```

This will:
- Create the new training Lambda function
- Add `/training` and `/training/submit` API routes
- Configure proper permissions and authorizers

### 3. Update Database Schema

After the CDK stack is deployed, run the init-db endpoint to update the database:

```bash
# Get your API URL from CDK outputs or AWS Console
export API_URL="https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/dev"

# Run the init-db endpoint (no auth required)
curl -X POST $API_URL/admin/init-db
```

This will:
- Add `training_completed` column to `reps` table (defaults to `false`)
- Create `training_progress` table
- Add `renter` and `not_interested` to `pin_status` enum
- Create necessary indexes

### 4. Deploy Frontend

The frontend changes are already included in your build. Deploy as usual:

```bash
# From project root
npm run build

# Deploy to GitHub Pages (or your hosting service)
npm run deploy
```

Or if using AWS S3/CloudFront for hosting:
```bash
aws s3 sync dist/ s3://your-bucket-name/ --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### 5. Verify Deployment

#### Check Lambda Function

```bash
aws lambda list-functions --query 'Functions[?contains(FunctionName, `training`)].FunctionName'
```

You should see something like: `insight-fuel-flow-training-dev`

#### Check API Gateway Routes

```bash
aws apigateway get-resources --rest-api-id YOUR_API_ID
```

Look for `/training` resource with GET and POST methods.

#### Test Training Endpoint

```bash
# Get an auth token (sign in as a rep)
export TOKEN="your-cognito-id-token"

# Test getting training progress
curl -X GET $API_URL/training \
  -H "Authorization: Bearer $TOKEN"

# Should return:
# {
#   "data": {
#     "training_completed": false,
#     "courses": []
#   }
# }
```

### 6. Test the Full Flow

1. **Create a Test Rep** (as admin):
   - Go to `/admin/reps`
   - Create a new rep account
   - Note the credentials

2. **Login as Rep**:
   - Sign in with the rep credentials
   - Should be redirected to `/learning` (not `/dashboard`)
   - Should see 3 training courses

3. **Complete a Course**:
   - Click "Start Course" on any course
   - Review the material
   - Click "Take Exam"
   - Answer all questions
   - Submit exam
   - Should see score and pass/fail message

4. **Complete All Courses**:
   - Pass all 3 exams (need 80% or higher)
   - Should see "All training completed!" message
   - "Go to Dashboard" button should appear

5. **Access Dashboard**:
   - Click "Go to Dashboard"
   - Should now have full access to rep features
   - Future logins should go directly to `/dashboard`

## Troubleshooting

### Lambda Function Not Found

If you get errors about the training Lambda not existing:

```bash
# Check CDK stack status
cdk list

# Re-deploy if needed
cdk deploy --all --context stage=dev --force
```

### Database Schema Issues

If you get database errors:

```bash
# Check RDS instance status
aws rds describe-db-instances --query 'DBInstances[?DBInstanceIdentifier==`insight-fuel-flow-db-dev`]'

# Re-run init-db
curl -X POST $API_URL/admin/init-db -v
```

### Training Progress Not Saving

Check CloudWatch logs for the training Lambda:

```bash
aws logs tail /aws/lambda/insight-fuel-flow-training-dev --follow
```

Common issues:
- Database connection timeout (check VPC/security groups)
- Missing permissions (check IAM role)
- Invalid exam answers format

### Rep Still Redirected to /learning After Completing Training

Check database:

```sql
-- Connect to RDS
psql -h YOUR_RDS_ENDPOINT -U postgres -d insightfuelflow

-- Check rep record
SELECT id, user_id, training_completed FROM reps WHERE user_id = 'USER_UUID';

-- Check training progress
SELECT * FROM training_progress WHERE rep_id = 'REP_UUID';
```

If `training_completed` is false but all courses are passed, manually update:

```sql
UPDATE reps SET training_completed = true WHERE id = 'REP_UUID';
```

### CORS Errors

If you get CORS errors when calling the training API:

1. Check API Gateway CORS configuration in CDK
2. Ensure preflight responses are configured
3. Redeploy API Gateway stage

```bash
aws apigateway create-deployment \
  --rest-api-id YOUR_API_ID \
  --stage-name dev
```

## Rollback

If you need to rollback the changes:

### 1. Remove Training Routes (CDK)

```bash
# Checkout previous version
git checkout HEAD~1 infrastructure/lib/api-stack.ts

# Redeploy
cdk deploy --all --context stage=dev
```

### 2. Remove Database Changes

```sql
-- Connect to RDS
psql -h YOUR_RDS_ENDPOINT -U postgres -d insightfuelflow

-- Drop training table
DROP TABLE IF EXISTS training_progress;

-- Remove column from reps
ALTER TABLE reps DROP COLUMN IF EXISTS training_completed;

-- Note: Cannot easily remove enum values without recreating the enum
-- Best to leave them in place or do a full schema rebuild
```

### 3. Redeploy Frontend

```bash
# Checkout previous version
git checkout HEAD~1

# Rebuild and deploy
npm run build
# Deploy as usual
```

## Monitoring

### CloudWatch Metrics

Monitor these metrics for the training Lambda:
- Invocations
- Errors
- Duration
- Throttles

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=insight-fuel-flow-training-dev \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### CloudWatch Logs

View real-time logs:

```bash
aws logs tail /aws/lambda/insight-fuel-flow-training-dev --follow
```

Filter for errors:

```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/insight-fuel-flow-training-dev \
  --filter-pattern "ERROR"
```

## Cost Considerations

The Learning Dashboard adds minimal cost:
- **Lambda**: ~$0.20 per 1M requests (very low usage expected)
- **RDS**: No additional cost (uses existing database)
- **API Gateway**: ~$3.50 per 1M requests (very low usage expected)

Expected monthly cost: < $1 for typical usage (assuming 50 reps completing training per month)

## Security Notes

1. **Exam Answers**: Never exposed to frontend, validated server-side only
2. **Training Status**: Checked on every route access, cannot be bypassed
3. **API Authorization**: All training endpoints require valid Cognito JWT
4. **Database**: Reps can only access their own training records

## Support

For issues or questions:
1. Check CloudWatch logs first
2. Review LEARNING_DASHBOARD.md for architecture details
3. Check AWS console for Lambda/API Gateway status
4. Contact the development team
