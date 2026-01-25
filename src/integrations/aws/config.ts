// AWS Configuration
// These values will be populated after deploying the CDK stack

export const awsConfig = {
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',

  // Cognito
  cognito: {
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
    userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || '',
  },

  // API Gateway
  api: {
    baseUrl: import.meta.env.VITE_API_URL || '',
  },

  // S3
  storage: {
    bucketName: import.meta.env.VITE_S3_BUCKET || '',
  },
};

// Validate configuration
export function validateAwsConfig(): boolean {
  const required = [
    awsConfig.cognito.userPoolId,
    awsConfig.cognito.userPoolClientId,
    awsConfig.api.baseUrl,
  ];

  return required.every(value => value && value.length > 0);
}
