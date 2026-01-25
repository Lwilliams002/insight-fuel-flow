// AWS Integration Exports
// Use these imports throughout the app after migrating from Supabase

export * from './config';
export * from './auth';
export * from './api';

// Re-export commonly used functions
export {
  signIn,
  signUp,
  signOut,
  getSession,
  getIdToken,
  getUserAttributes,
  isAdmin,
  isRep,
  getCurrentUser,
} from './auth';

export {
  dealsApi,
  repsApi,
  pinsApi,
  commissionsApi,
  uploadApi,
  adminApi,
} from './api';
