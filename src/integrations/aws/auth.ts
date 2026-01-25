import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';
import { awsConfig } from './config';

// Initialize User Pool
const userPool = new CognitoUserPool({
  UserPoolId: awsConfig.cognito.userPoolId,
  ClientId: awsConfig.cognito.userPoolClientId,
});

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface AuthUser {
  sub: string;
  email: string;
  fullName?: string;
  groups: string[];
}

// Get current authenticated user
export function getCurrentUser(): CognitoUser | null {
  return userPool.getCurrentUser();
}

// Get current session
export async function getSession(): Promise<CognitoUserSession | null> {
  const user = getCurrentUser();
  if (!user) return null;

  return new Promise((resolve, reject) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) {
        reject(err);
      } else {
        resolve(session);
      }
    });
  });
}

// Get ID token for API calls
export async function getIdToken(): Promise<string | null> {
  const session = await getSession();
  return session?.getIdToken().getJwtToken() || null;
}

// Get user attributes
export async function getUserAttributes(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session) return null;

  const idToken = session.getIdToken();
  const payload = idToken.payload;

  return {
    sub: payload.sub,
    email: payload.email,
    fullName: payload.name,
    groups: payload['cognito:groups'] || [],
  };
}

// Check if user is admin
export async function isAdmin(): Promise<boolean> {
  const user = await getUserAttributes();
  return user?.groups.includes('admin') || false;
}

// Check if user is rep
export async function isRep(): Promise<boolean> {
  const user = await getUserAttributes();
  return user?.groups.includes('rep') || false;
}

// Sign up
export async function signUp({ email, password, fullName }: SignUpParams): Promise<void> {
  const attributes = [
    new CognitoUserAttribute({ Name: 'email', Value: email }),
    new CognitoUserAttribute({ Name: 'name', Value: fullName }),
  ];

  return new Promise((resolve, reject) => {
    userPool.signUp(email, password, attributes, [], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Sign in
export async function signIn({ email, password }: SignInParams): Promise<CognitoUserSession> {
  const user = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  const authDetails = new AuthenticationDetails({
    Username: email,
    Password: password,
  });

  return new Promise((resolve, reject) => {
    user.authenticateUser(authDetails, {
      onSuccess: (session) => {
        resolve(session);
      },
      onFailure: (err) => {
        reject(err);
      },
      newPasswordRequired: (userAttributes, requiredAttributes) => {
        // Handle new password required (first login after admin creates user)
        reject(new Error('NEW_PASSWORD_REQUIRED'));
      },
    });
  });
}

// Sign out
export function signOut(): void {
  const user = getCurrentUser();
  if (user) {
    user.signOut();
  }
}

// Confirm sign up (email verification)
export async function confirmSignUp(email: string, code: string): Promise<void> {
  const user = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  return new Promise((resolve, reject) => {
    user.confirmRegistration(code, true, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Forgot password
export async function forgotPassword(email: string): Promise<void> {
  const user = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  return new Promise((resolve, reject) => {
    user.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

// Confirm forgot password
export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  const user = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  return new Promise((resolve, reject) => {
    user.confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

// Change password
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('No user logged in');

  return new Promise((resolve, reject) => {
    user.changePassword(oldPassword, newPassword, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
