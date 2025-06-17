
import { User, Session } from '@supabase/supabase-js';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGoogleConnected: boolean;
  authError: string | null;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  isTokenValid: () => boolean;
  forceTokenRefresh: () => Promise<boolean>;
  getGoogleOAuthToken: () => string | null;
}
