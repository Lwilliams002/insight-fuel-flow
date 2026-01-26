import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  stage: string;
  appName: string;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  vpc: ec2.IVpc;
  database: rds.DatabaseInstance;
  databaseSecret: secretsmanager.ISecret;
  storageBucket: s3.Bucket;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { stage, appName, userPool, userPoolClient, vpc, database, databaseSecret, storageBucket } = props;

    // Create security group for Lambda functions
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      securityGroupName: `${appName}-lambda-sg-${stage}`,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    // Common Lambda environment variables
    const commonEnv = {
      NODE_ENV: stage === 'prod' ? 'production' : 'development',
      DATABASE_SECRET_ARN: databaseSecret.secretArn,
      DATABASE_HOST: database.dbInstanceEndpointAddress,
      DATABASE_PORT: database.dbInstanceEndpointPort,
      DATABASE_NAME: 'insightfuelflow',
      S3_BUCKET: storageBucket.bucketName,
      USER_POOL_ID: userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      MAPBOX_TOKEN: process.env.MAPBOX_TOKEN || '',
    };

    // Common Lambda configuration
    const lambdaConfig = {
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSecurityGroup],
      environment: commonEnv,
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    };

    // Create Lambda functions
    const dealsFunction = new lambdaNodejs.NodejsFunction(this, 'DealsFunction', {
      ...lambdaConfig,
      functionName: `${appName}-deals-${stage}`,
      entry: path.join(__dirname, '../lambda/deals/index.ts'),
      handler: 'handler',
    });

    const repsFunction = new lambdaNodejs.NodejsFunction(this, 'RepsFunction', {
      ...lambdaConfig,
      functionName: `${appName}-reps-${stage}`,
      entry: path.join(__dirname, '../lambda/reps/index.ts'),
      handler: 'handler',
    });

    const pinsFunction = new lambdaNodejs.NodejsFunction(this, 'PinsFunction', {
      ...lambdaConfig,
      functionName: `${appName}-pins-${stage}`,
      entry: path.join(__dirname, '../lambda/pins/index.ts'),
      handler: 'handler',
    });

    const commissionsFunction = new lambdaNodejs.NodejsFunction(this, 'CommissionsFunction', {
      ...lambdaConfig,
      functionName: `${appName}-commissions-${stage}`,
      entry: path.join(__dirname, '../lambda/commissions/index.ts'),
      handler: 'handler',
    });

    const uploadFunction = new lambdaNodejs.NodejsFunction(this, 'UploadFunction', {
      ...lambdaConfig,
      functionName: `${appName}-upload-${stage}`,
      entry: path.join(__dirname, '../lambda/upload/index.ts'),
      handler: 'handler',
    });

    const adminFunction = new lambdaNodejs.NodejsFunction(this, 'AdminFunction', {
      ...lambdaConfig,
      functionName: `${appName}-admin-${stage}`,
      entry: path.join(__dirname, '../lambda/admin/index.ts'),
      handler: 'handler',
    });

    // Database initialization function
    const initDbFunction = new lambdaNodejs.NodejsFunction(this, 'InitDbFunction', {
      ...lambdaConfig,
      functionName: `${appName}-init-db-${stage}`,
      entry: path.join(__dirname, '../lambda/init-db/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(60), // Longer timeout for schema creation
    });

    // Training function
    const trainingFunction = new lambdaNodejs.NodejsFunction(this, 'TrainingFunction', {
      ...lambdaConfig,
      functionName: `${appName}-training-${stage}`,
      entry: path.join(__dirname, '../lambda/training/index.ts'),
      handler: 'handler',
    });

    // Grant permissions
    const allFunctions = [dealsFunction, repsFunction, pinsFunction, commissionsFunction, uploadFunction, adminFunction, initDbFunction, trainingFunction];

    allFunctions.forEach(fn => {
      databaseSecret.grantRead(fn);
      storageBucket.grantReadWrite(fn);
    });

    // Admin function needs Cognito admin permissions
    adminFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminUpdateUserAttributes',
        'cognito-idp:ListUsersInGroup',
      ],
      resources: [userPool.userPoolArn],
    }));

    // Create API Gateway
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `${appName}-api-${stage}`,
      description: 'Insight Fuel Flow API',
      deployOptions: {
        stageName: stage,
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 2000,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: stage === 'prod'
          ? ['https://your-production-domain.com']
          : apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key'],
        allowCredentials: true,
      },
    });

    // Create Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'CognitoAuthorizer',
      identitySource: 'method.request.header.Authorization',
    });

    const authorizerOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // API Routes
    // Deals
    const deals = this.api.root.addResource('deals');
    deals.addMethod('GET', new apigateway.LambdaIntegration(dealsFunction), authorizerOptions);
    deals.addMethod('POST', new apigateway.LambdaIntegration(dealsFunction), authorizerOptions);

    const dealById = deals.addResource('{id}');
    dealById.addMethod('GET', new apigateway.LambdaIntegration(dealsFunction), authorizerOptions);
    dealById.addMethod('PUT', new apigateway.LambdaIntegration(dealsFunction), authorizerOptions);
    dealById.addMethod('DELETE', new apigateway.LambdaIntegration(dealsFunction), authorizerOptions);

    // Reps
    const reps = this.api.root.addResource('reps');
    reps.addMethod('GET', new apigateway.LambdaIntegration(repsFunction), authorizerOptions);
    reps.addMethod('POST', new apigateway.LambdaIntegration(repsFunction), authorizerOptions);

    const repById = reps.addResource('{id}');
    repById.addMethod('GET', new apigateway.LambdaIntegration(repsFunction), authorizerOptions);
    repById.addMethod('PUT', new apigateway.LambdaIntegration(repsFunction), authorizerOptions);
    repById.addMethod('DELETE', new apigateway.LambdaIntegration(repsFunction), authorizerOptions);

    // Pins
    const pins = this.api.root.addResource('pins');
    pins.addMethod('GET', new apigateway.LambdaIntegration(pinsFunction), authorizerOptions);
    pins.addMethod('POST', new apigateway.LambdaIntegration(pinsFunction), authorizerOptions);

    const pinById = pins.addResource('{id}');
    pinById.addMethod('GET', new apigateway.LambdaIntegration(pinsFunction), authorizerOptions);
    pinById.addMethod('PUT', new apigateway.LambdaIntegration(pinsFunction), authorizerOptions);
    pinById.addMethod('DELETE', new apigateway.LambdaIntegration(pinsFunction), authorizerOptions);

    // Commissions
    const commissions = this.api.root.addResource('commissions');
    commissions.addMethod('GET', new apigateway.LambdaIntegration(commissionsFunction), authorizerOptions);
    commissions.addMethod('POST', new apigateway.LambdaIntegration(commissionsFunction), authorizerOptions);

    const commissionById = commissions.addResource('{id}');
    commissionById.addMethod('PUT', new apigateway.LambdaIntegration(commissionsFunction), authorizerOptions);

    // Upload (pre-signed URLs)
    const upload = this.api.root.addResource('upload');
    upload.addMethod('POST', new apigateway.LambdaIntegration(uploadFunction), authorizerOptions);

    const uploadUrl = upload.addResource('url');
    uploadUrl.addMethod('POST', new apigateway.LambdaIntegration(uploadFunction), authorizerOptions);

    // Admin
    const admin = this.api.root.addResource('admin');
    const createRep = admin.addResource('create-rep');
    createRep.addMethod('POST', new apigateway.LambdaIntegration(adminFunction), authorizerOptions);

    const createAdmin = admin.addResource('create-admin');
    createAdmin.addMethod('POST', new apigateway.LambdaIntegration(adminFunction), authorizerOptions);

    const syncReps = admin.addResource('sync-reps');
    syncReps.addMethod('POST', new apigateway.LambdaIntegration(adminFunction), authorizerOptions);

    // Init DB (no auth - for initial setup only)
    const initDb = admin.addResource('init-db');
    initDb.addMethod('POST', new apigateway.LambdaIntegration(initDbFunction));

    // Training
    const training = this.api.root.addResource('training');
    training.addMethod('GET', new apigateway.LambdaIntegration(trainingFunction), authorizerOptions);
    
    const trainingSubmit = training.addResource('submit');
    trainingSubmit.addMethod('POST', new apigateway.LambdaIntegration(trainingFunction), authorizerOptions);

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });
  }
}
