import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import {
  CognitoUserPool,
  CognitoUser,
  CognitoUserAttribute,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { awsConfig } from '../constants/config';

type UserRole = 'admin' | 'rep' | null;

interface User {
  sub: string;
  email: string;
  fullName?: string;
}

interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Configure AsyncStorage for Cognito - must return synchronously for Cognito SDK
// We use a memory cache that syncs with AsyncStorage
class CognitoStorageAdapter {
  private memoryStorage: Record<string, string> = {};
  private syncPromise: Promise<void> | null = null;

  constructor() {
    // Load from AsyncStorage on init
    this.syncPromise = this.loadFromAsyncStorage();
  }

  private async loadFromAsyncStorage() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cognitoKeys = keys.filter(k => k.startsWith('CognitoIdentityServiceProvider'));
      if (cognitoKeys.length > 0) {
        const pairs = await AsyncStorage.multiGet(cognitoKeys);
        pairs.forEach(([key, value]) => {
          if (value) this.memoryStorage[key] = value;
        });
      }
      console.log('[CognitoStorage] Loaded', Object.keys(this.memoryStorage).length, 'keys from storage');
    } catch (e) {
      console.log('[CognitoStorage] Error loading from AsyncStorage:', e);
    }
  }

  async waitForSync() {
    if (this.syncPromise) {
      await this.syncPromise;
      this.syncPromise = null;
    }
  }

  getItem(key: string): string | null {
    return this.memoryStorage[key] || null;
  }

  setItem(key: string, value: string): string {
    this.memoryStorage[key] = value;
    AsyncStorage.setItem(key, value).catch(e => console.log('[CognitoStorage] Error saving:', e));
    return value;
  }

  removeItem(key: string): void {
    delete this.memoryStorage[key];
    AsyncStorage.removeItem(key).catch(e => console.log('[CognitoStorage] Error removing:', e));
  }

  clear(): void {
    const keys = Object.keys(this.memoryStorage);
    this.memoryStorage = {};
    keys.forEach(key => {
      AsyncStorage.removeItem(key).catch(e => console.log('[CognitoStorage] Error clearing:', e));
    });
  }
}

const cognitoStorage = new CognitoStorageAdapter();

// Initialize User Pool with custom storage
const userPool = new CognitoUserPool({
  UserPoolId: awsConfig.cognito.userPoolId,
  ClientId: awsConfig.cognito.userPoolClientId,
  Storage: cognitoStorage as any,
});

export function AuthProvider({ children }: { children: ReactNode }) {
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
    console.log('[Auth] Refreshing session...');

    try {
      // Wait for storage to sync from AsyncStorage
      await cognitoStorage.waitForSync();

      const cognitoUser = userPool.getCurrentUser();

      if (!cognitoUser) {
        console.log('[Auth] No current user found, redirecting to login');
        setUser(null);
        setSession(null);
        setRole(null);
        setLoading(false);
        return;
      }

      console.log('[Auth] Found current user, getting session...');

      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Session timeout')), 5000);
      });

      const sessionPromise = new Promise<void>((resolve) => {
        cognitoUser.getSession((err: Error | null, cognitoSession: CognitoUserSession | null) => {
          if (err || !cognitoSession) {
            console.log('[Auth] Session error or no session:', err?.message);
            setUser(null);
            setSession(null);
            setRole(null);
          } else {
            console.log('[Auth] Session valid, extracting user info');
            setSession(cognitoSession);
            setUser(extractUserFromSession(cognitoSession));
            setRole(extractRoleFromSession(cognitoSession));
          }
          resolve();
        });
      });

      await Promise.race([sessionPromise, timeoutPromise]);
    } catch (error) {
      console.log('[Auth] Error during session refresh:', error);
      setUser(null);
      setSession(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, [extractUserFromSession, extractRoleFromSession]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null; newPasswordRequired?: boolean }> => {
    console.log('[Auth] Attempting sign in for:', email);
    console.log('[Auth] UserPool config:', {
      userPoolId: awsConfig.cognito.userPoolId,
      clientId: awsConfig.cognito.userPoolClientId
    });

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
      Storage: cognitoStorage as any,
    });

    cognitoUserRef.current = cognitoUser;

    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    return new Promise((resolve) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (cognitoSession) => {
          console.log('[Auth] Sign in successful!');
          const extractedUser = extractUserFromSession(cognitoSession);
          const extractedRole = extractRoleFromSession(cognitoSession);
          console.log('[Auth] User:', extractedUser.email, 'Role:', extractedRole);

          setSession(cognitoSession);
          setUser(extractedUser);
          setRole(extractedRole);
          setNewPasswordRequired(false);
          resolve({ error: null });
        },
        onFailure: (err) => {
          console.error('Sign in error:', err);
          resolve({ error: err });
        },
        newPasswordRequired: (userAttributes) => {
          console.log('[Auth] New password required');
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
      return { error: new Error('No user session found') };
    }

    return new Promise((resolve) => {
      const { email, ...requiredAttributes } = userAttributesRef.current;
      cognitoUser.completeNewPasswordChallenge(newPassword, requiredAttributes, {
        onSuccess: (cognitoSession) => {
          setSession(cognitoSession);
          setUser(extractUserFromSession(cognitoSession));
          setRole(extractRoleFromSession(cognitoSession));
          setNewPasswordRequired(false);
          resolve({ error: null });
        },
        onFailure: (err) => {
          resolve({ error: err });
        },
      });
    });
  };

  const signUp = async (email: string, password: string, fullName: string): Promise<{ error: Error | null }> => {
    const attributeList = [
      new CognitoUserAttribute({ Name: 'email', Value: email.toLowerCase() }),
      new CognitoUserAttribute({ Name: 'name', Value: fullName }),
    ];

    return new Promise((resolve) => {
      userPool.signUp(email.toLowerCase(), password, attributeList, [], (err) => {
        if (err) {
          resolve({ error: err });
        } else {
          resolve({ error: null });
        }
      });
    });
  };

  const signOut = async (): Promise<void> => {
    try {
      const cognitoUser = userPool.getCurrentUser();
      if (cognitoUser) {
        // Global sign out to invalidate all tokens
        cognitoUser.globalSignOut({
          onSuccess: () => {
            console.log('[Auth] Global sign out successful');
          },
          onFailure: (err) => {
            console.log('[Auth] Global sign out failed, using local sign out:', err);
            cognitoUser.signOut();
          },
        });
      }

      // Clear the Cognito storage
      cognitoStorage.clear();

      // Clear all state
      setUser(null);
      setSession(null);
      setRole(null);
      setNewPasswordRequired(false);

      console.log('[Auth] Sign out complete');
    } catch (error) {
      console.error('[Auth] Sign out error:', error);
      // Still clear state even if there's an error
      setUser(null);
      setSession(null);
      setRole(null);
      setNewPasswordRequired(false);
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (session?.isValid()) {
      return session.getIdToken().getJwtToken();
    }

    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) return null;

    return new Promise((resolve) => {
      cognitoUser.getSession((err: Error | null, cognitoSession: CognitoUserSession | null) => {
        if (err || !cognitoSession) {
          resolve(null);
        } else {
          setSession(cognitoSession);
          resolve(cognitoSession.getIdToken().getJwtToken());
        }
      });
    });
  };

  return (
    <AuthContext.Provider
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
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
