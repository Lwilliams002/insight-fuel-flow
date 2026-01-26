import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { awsConfig } from '@/integrations/aws/config';

type UserRole = 'admin' | 'rep' | null;

interface User {
  sub: string;
  email: string;
  fullName?: string;
}

interface AwsAuthContextType {
  user: User | null;
  session: CognitoUserSession | null;
  role: UserRole;
  loading: boolean;
  newPasswordRequired: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; newPasswordRequired?: boolean }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  completeNewPassword: (newPassword: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AwsAuthContext = createContext<AwsAuthContextType | undefined>(undefined);

// Initialize User Pool
const userPool = new CognitoUserPool({
  UserPoolId: awsConfig.cognito.userPoolId,
  ClientId: awsConfig.cognito.userPoolClientId,
});

export function AwsAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<CognitoUserSession | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [newPasswordRequired, setNewPasswordRequired] = useState(false);
  const cognitoUserRef = useRef<CognitoUser | null>(null);
  const userAttributesRef = useRef<Record<string, string>>({});

  const extractUserFromSession = useCallback((cognitoSession: CognitoUserSession): User => {
    const idToken = cognitoSession.getIdToken();
    const payload = idToken.payload;
    return {
      sub: payload.sub,
      email: payload.email,
      fullName: payload.name,
    };
  }, []);

  const extractRoleFromSession = useCallback((cognitoSession: CognitoUserSession): UserRole => {
    const idToken = cognitoSession.getIdToken();
    const groups: string[] = idToken.payload['cognito:groups'] || [];

    if (groups.includes('admin')) return 'admin';
    if (groups.includes('rep')) return 'rep';
    return null;
  }, []);

  const refreshSession = useCallback(async () => {
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      setUser(null);
      setSession(null);
      setRole(null);
      setLoading(false);
      return;
    }

    cognitoUser.getSession((err: Error | null, cognitoSession: CognitoUserSession | null) => {
      if (err || !cognitoSession) {
        setUser(null);
        setSession(null);
        setRole(null);
      } else {
        setSession(cognitoSession);
        setUser(extractUserFromSession(cognitoSession));
        setRole(extractRoleFromSession(cognitoSession));
      }
      setLoading(false);
    });
  }, [extractUserFromSession, extractRoleFromSession]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null; newPasswordRequired?: boolean }> => {
    console.log('Attempting sign in with:', email);
    console.log('UserPool config:', { userPoolId: awsConfig.cognito.userPoolId, clientId: awsConfig.cognito.userPoolClientId });

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    return new Promise((resolve) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (cognitoSession) => {
          console.log('Sign in successful!', cognitoSession);
          setSession(cognitoSession);
          setUser(extractUserFromSession(cognitoSession));
          setRole(extractRoleFromSession(cognitoSession));
          setNewPasswordRequired(false);
          resolve({ error: null });
        },
        onFailure: (err) => {
          console.error('Sign in failed:', err);
          resolve({ error: err });
        },
        newPasswordRequired: (userAttributes) => {
          console.log('New password required', userAttributes);
          // Store the cognito user and attributes for completing password change
          cognitoUserRef.current = cognitoUser;
          // Remove read-only attributes that can't be updated
          delete userAttributes.email_verified;
          delete userAttributes.email;
          userAttributesRef.current = userAttributes;
          setNewPasswordRequired(true);
          resolve({ error: null, newPasswordRequired: true });
        },
      });
    });
  };

  const completeNewPassword = async (newPassword: string): Promise<{ error: Error | null }> => {
    const cognitoUser = cognitoUserRef.current;

    if (!cognitoUser) {
      return { error: new Error('No pending password change. Please sign in again.') };
    }

    return new Promise((resolve) => {
      cognitoUser.completeNewPasswordChallenge(newPassword, userAttributesRef.current, {
        onSuccess: (cognitoSession) => {
          console.log('Password change successful!', cognitoSession);
          setSession(cognitoSession);
          setUser(extractUserFromSession(cognitoSession));
          setRole(extractRoleFromSession(cognitoSession));
          setNewPasswordRequired(false);
          cognitoUserRef.current = null;
          userAttributesRef.current = {};
          resolve({ error: null });
        },
        onFailure: (err) => {
          console.error('Password change failed:', err);
          resolve({ error: err });
        },
      });
    });
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ error: Error | null }> => {
    return new Promise((resolve) => {
      userPool.signUp(
        email,
        password,
        [
          { Name: 'email', Value: email },
          { Name: 'name', Value: fullName },
        ],
        [],
        (err) => {
          if (err) {
            resolve({ error: err });
          } else {
            resolve({ error: null });
          }
        }
      );
    });
  };

  const signOut = async (): Promise<void> => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    setUser(null);
    setSession(null);
    setRole(null);
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!session) return null;

    // Check if token is expired and refresh if needed
    if (!session.isValid()) {
      await refreshSession();
      return session?.getIdToken().getJwtToken() || null;
    }

    return session.getIdToken().getJwtToken();
  };

  return (
    <AwsAuthContext.Provider
      value={{
        user,
        session,
        role,
        loading,
        newPasswordRequired,
        signIn,
        signUp,
        completeNewPassword,
        signOut,
        getIdToken,
      }}
    >
      {children}
    </AwsAuthContext.Provider>
  );
}

export function useAwsAuth() {
  const context = useContext(AwsAuthContext);
  if (context === undefined) {
    throw new Error('useAwsAuth must be used within an AwsAuthProvider');
  }
  return context;
}

// Alias for backward compatibility with existing components
export const useAuth = useAwsAuth;
export const AuthProvider = AwsAuthProvider;

