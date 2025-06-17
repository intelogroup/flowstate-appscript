
import { useEffect, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
  const backgroundTokenService = useRef<{ 
    saveTokens: (session: Session) => void; 
    deleteTokens: (userId: string) => void;
  }>();

  // Initialize background token service with enhanced error handling
  useEffect(() => {
    backgroundTokenService.current = {
      saveTokens: (session: Session) => {
        // Run token saving in background without blocking auth state
        setTimeout(async () => {
          try {
            const { AuthTokenService } = await import('@/services/authTokenService');
            await AuthTokenService.saveTokensBackground(session);
            console.log('[AUTH_LISTENER] Background: Tokens saved successfully');
          } catch (error) {
            // Error is already handled in saveTokensBackground, just log for debugging
            console.error('[AUTH_LISTENER] Background: Token save wrapper error:', error);
          }
        }, 0);
      },
      deleteTokens: (userId: string) => {
        // Run token deletion in background without blocking auth state
        setTimeout(async () => {
          try {
            const { AuthTokenService } = await import('@/services/authTokenService');
            await AuthTokenService.deleteTokens(userId);
            console.log('[AUTH_LISTENER] Background: Tokens deleted successfully');
          } catch (error) {
            console.error('[AUTH_LISTENER] Background: Failed to delete tokens (non-critical):', error);
          }
        }, 0);
      }
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    console.log('[AUTH_LISTENER] Initializing auth state listener...');

    // Initialize auth state first
    const initializeAuth = async () => {
      try {
        console.log('[AUTH_LISTENER] Getting initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mountedRef.current) return;

        if (error) {
          console.error('[AUTH_LISTENER] Error getting initial session:', error);
          setAuthError('Failed to initialize authentication');
        } else {
          console.log('[AUTH_LISTENER] Initial session loaded:', { hasSession: !!session });
          setSession(session);
          setUser(session?.user ?? null);
          setAuthError(null);
        }
      } catch (error) {
        console.error('[AUTH_LISTENER] Critical error during auth initialization:', error);
        if (mountedRef.current) {
          setAuthError('Authentication initialization failed');
        }
      } finally {
        // ALWAYS set loading to false, regardless of success or failure
        if (mountedRef.current) {
          console.log('[AUTH_LISTENER] Setting loading to false');
          setLoading(false);
        }
      }
    };

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return;

        console.log('[AUTH_LISTENER] Auth state change:', event, {
          hasSession: !!session,
          provider: session?.user?.app_metadata?.provider,
          userId: session?.user?.id
        });
        
        try {
          // Always update state synchronously first
          setSession(session);
          setUser(session?.user ?? null);
          setAuthError(null);
          
          // Handle background token operations based on event - completely isolated
          if (event === 'SIGNED_IN' && session) {
            console.log('[AUTH_LISTENER] User signed in, scheduling background token save');
            backgroundTokenService.current?.saveTokens(session);
          }
          
          if (event === 'SIGNED_OUT') {
            console.log('[AUTH_LISTENER] User signed out');
            // Try to clean up tokens if we have a user ID
            const userId = session?.user?.id;
            if (userId) {
              backgroundTokenService.current?.deleteTokens(userId);
            }
          }

          if (event === 'TOKEN_REFRESHED' && session) {
            console.log('[AUTH_LISTENER] Token refreshed, scheduling background token save');
            backgroundTokenService.current?.saveTokens(session);
          }

          // Ensure loading is false for auth state changes
          setLoading(false);
        } catch (error) {
          console.error('[AUTH_LISTENER] Error handling auth state change:', error);
          setAuthError('Authentication state update failed');
          setLoading(false);
        }
      }
    );

    // Initialize auth after setting up listener
    initializeAuth();

    return () => {
      console.log('[AUTH_LISTENER] Cleaning up auth state listener');
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [setSession, setUser, setAuthError, setLoading]);

  return { mountedRef };
};
