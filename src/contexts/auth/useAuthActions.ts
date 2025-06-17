
import { useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuthActions = (
  setAuthError: (error: string | null) => void,
  setLoading: (loading: boolean) => void,
  setSession: (session: Session | null) => void,
  setUser: (user: User | null) => void,
  forceTokenRefresh: () => Promise<boolean>
) => {
  const signInWithGoogle = useCallback(async () => {
    try {
      setAuthError(null);
      setLoading(true);
      
      console.log('[AUTH] Starting Google OAuth sign-in with enhanced scopes...');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/app`,
          scopes: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/drive.file',
            'openid',
            'email',
            'profile'
          ].join(' '),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) {
        console.error('[AUTH] Google OAuth error:', error);
        setAuthError(`Google sign-in failed: ${error.message}`);
      } else {
        console.log('[AUTH] Google OAuth initiated successfully');
      }
    } catch (error) {
      console.error('[AUTH] Unexpected error during Google sign-in:', error);
      setAuthError('Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  }, [setAuthError, setLoading]);

  const refreshSession = useCallback(async () => {
    try {
      console.log('[AUTH] Manual session refresh requested...');
      const success = await forceTokenRefresh();
      
      if (!success) {
        console.log('[AUTH] Manual refresh failed, suggesting re-authentication');
      }
    } catch (error) {
      console.error('[AUTH] Manual refresh error:', error);
      setAuthError('Session refresh failed. Please sign in again.');
    }
  }, [forceTokenRefresh, setAuthError]);

  const signOut = useCallback(async () => {
    console.log('[AUTH] Signing out user...');
    try {
      setAuthError(null);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('[AUTH] Error during sign out:', error);
    }
  }, [setUser, setSession, setAuthError]);

  return { signInWithGoogle, refreshSession, signOut };
};
