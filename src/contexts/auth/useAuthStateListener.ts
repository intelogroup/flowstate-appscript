
import { useEffect, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthTokenService } from '@/services/authTokenService';

interface UseAuthStateListenerProps {
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setAuthError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStateListener = ({
  setSession,
  setUser,
  setAuthError,
  setLoading
}: UseAuthStateListenerProps) => {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return;

        console.log('[AUTH_LISTENER] Auth state change:', event, {
          hasSession: !!session,
          provider: session?.user?.app_metadata?.provider
        });
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN' && session) {
          setAuthError(null);
          try {
            await AuthTokenService.saveTokens(session);
            console.log('[AUTH_LISTENER] Tokens saved on sign in');
          } catch (error) {
            console.error('[AUTH_LISTENER] Failed to save tokens:', error);
          }
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('[AUTH_LISTENER] User signed out');
          setAuthError(null);
          if (session?.user?.id) {
            try {
              await AuthTokenService.deleteTokens(session.user.id);
            } catch (error) {
              console.error('[AUTH_LISTENER] Failed to clean up tokens:', error);
            }
          }
        }

        if (event === 'TOKEN_REFRESHED' && session) {
          console.log('[AUTH_LISTENER] Token refreshed');
          setAuthError(null);
          try {
            await AuthTokenService.saveTokens(session);
          } catch (error) {
            console.error('[AUTH_LISTENER] Failed to save refreshed tokens:', error);
          }
        }

        setLoading(false);
      }
    );

    // Initialize auth state
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mountedRef.current) return;

        if (error) {
          console.error('[AUTH_LISTENER] Error getting session:', error);
          setAuthError('Failed to get session');
          setLoading(false);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      } catch (error) {
        console.error('[AUTH_LISTENER] Error during auth initialization:', error);
        if (mountedRef.current) {
          setAuthError('Authentication initialization failed');
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [setSession, setUser, setAuthError, setLoading]);

  return { mountedRef };
};
