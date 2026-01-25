#!/usr/bin/env node
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/auth-stack';
import { DatabaseStack } from '../lib/database-stack';
import { StorageStack } from '../lib/storage-stack';
import { ApiStack } from '../lib/api-stack';

const app = new cdk.App();

const stage = app.node.tryGetContext('stage') || 'dev';
const appName = 'InsightFuelFlow';

// Environment configuration
const env = {
  account: process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Cognito Authentication Stack
const authStack = new AuthStack(app, `${appName}-Auth-${stage}`, {
  env,
  stage,
  appName,
});

// RDS PostgreSQL Database Stack
const databaseStack = new DatabaseStack(app, `${appName}-Database-${stage}`, {
  env,
  stage,
  appName,
});

// S3 Storage Stack
const storageStack = new StorageStack(app, `${appName}-Storage-${stage}`, {
  env,
  stage,
  appName,
});

// API Gateway + Lambda Stack
const apiStack = new ApiStack(app, `${appName}-Api-${stage}`, {
  env,
  stage,
  appName,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  vpc: databaseStack.vpc,
  database: databaseStack.database,
  databaseSecret: databaseStack.databaseSecret,
  storageBucket: storageStack.bucket,
});

// Add dependencies
apiStack.addDependency(authStack);
apiStack.addDependency(databaseStack);
apiStack.addDependency(storageStack);

// Output important values
new cdk.CfnOutput(authStack, 'UserPoolId', {
  value: authStack.userPool.userPoolId,
  exportName: `${appName}-UserPoolId-${stage}`,
});

new cdk.CfnOutput(authStack, 'UserPoolClientId', {
  value: authStack.userPoolClient.userPoolClientId,
  exportName: `${appName}-UserPoolClientId-${stage}`,
});

new cdk.CfnOutput(storageStack, 'StorageBucketName', {
  value: storageStack.bucket.bucketName,
  exportName: `${appName}-StorageBucket-${stage}`,
});

app.synth();
