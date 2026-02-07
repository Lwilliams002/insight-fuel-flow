// AWS Configuration - same as web app
export const awsConfig = {
  region: process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1',
  cognito: {
    userPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || '',
    userPoolClientId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_CLIENT_ID || '',
  },
  api: {
    baseUrl: process.env.EXPO_PUBLIC_API_URL || '',
  },
  storage: {
    bucketName: process.env.EXPO_PUBLIC_S3_BUCKET || '',
  },
};

// Theme colors matching web app
export const colors = {
  primary: '#C9A24D', // Gold
  secondary: '#0F1E2E', // Dark blue
  background: '#FFFFFF',
  foreground: '#0F1E2E',
  muted: '#F5F5F5',
  mutedForeground: '#737373',
  border: '#E5E5E5',
  destructive: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  info: '#3B82F6',
};

// Dark theme colors
export const darkColors = {
  primary: '#C9A24D',
  secondary: '#1A2F45', // Slightly lighter for button backgrounds
  background: '#0F1E2E',
  foreground: '#FFFFFF',
  muted: '#1E3A5F',
  mutedForeground: '#94A3B8',
  border: '#334155',
  destructive: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  info: '#3B82F6',
};
