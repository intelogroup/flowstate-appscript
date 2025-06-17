
import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType } from './auth/types';
import { useTokenValidation } from './auth/useTokenValidation';
import { useGoogleConnection } from './auth/useGoogleConnection';
import { useAuthActions } from './auth/useAuthActions';
import { useEnhancedTokenManagement } from './auth/useEnhancedTokenManagement';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = React.memo(({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Ref to track if component is mounted
  const mountedRef = useRef(true);

  // Enhanced token management with race condition protection
  const {
    forceTokenRefresh,
    getValidGoogleToken,
    ensureValidSession,
    scheduleTokenRefresh,
    cleanup
  } = useEnhancedTokenManagement(setSession, setUser, setAuthError);

  // Existing hooks with enhanced token management
  const { isTokenValid, getGoogleOAuthToken } = useTokenValidation(session);
  const { isGoogleConnected } = useGoogleConnection(session, isTokenValid, setAuthError);
  const { signInWithGoogle, refreshSession, signOut } = useAuthActions(
    setAuthError,
    setLoading,
    setSession,
    setUser,
    forceTokenRefresh
  );

  // Set up auth state listener with enhanced token handling
  useEffect(() => {
    mountedRef.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return;

        console.log('[AUTH] Auth state change:', event, {
          hasSession: !!session,
          provider: session?.user?.app_metadata?.provider,
          hasProviderToken: !!session?.provider_token,
          hasAccessToken: !!session?.access_token,
          expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'none'
        });
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Enhanced auth event handling
        if (event === 'SIGNED_IN' && session) {
          setAuthError(null);
          console.log('[AUTH] User signed in successfully');
          
          // Schedule proactive token refresh
          scheduleTokenRefresh(session);
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('[AUTH] User signed out');
          setAuthError(null);
          cleanup(); // Clean up scheduled refreshes
        }

        if (event === 'TOKEN_REFRESHED' && session) {
          console.log('[AUTH] Token refreshed via auth state change');
          setAuthError(null);
          scheduleTokenRefresh(session);
        }

        // Only set loading to false after the first auth state change
        if (loading) {
          setLoading(false);
        }
      }
    );

    // Initialize auth state with enhanced validation
    const initializeAuth = async () => {
      try {
        console.log('[AUTH] Initializing enhanced auth...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mountedRef.current) return;

        if (error) {
          console.error('[AUTH] Error getting session:', error);
          setAuthError('Failed to get session');
          setLoading(false);
          return;
        }

        console.log('[AUTH] Initial session check:', {
          hasSession: !!session,
          provider: session?.user?.app_metadata?.provider,
          hasProviderToken: !!session?.provider_token,
          hasAccessToken: !!session?.access_token,
          expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'none'
        });
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Enhanced Google token validation with proactive refresh
        if (session && session.user?.app_metadata?.provider === 'google') {
          const now = Date.now() / 1000;
          const expiresAt = session.expires_at || 0;
          const timeUntilExpiry = expiresAt - now;
          
          if (!session.provider_token && !session.access_token) {
            console.error('[AUTH] Google session exists but missing all OAuth tokens');
            setAuthError('Google authentication incomplete. Please sign in again.');
          } else if (timeUntilExpiry <= 300) { // 5 minutes buffer
            console.log('[AUTH] Google tokens expire soon, attempting proactive refresh...');
            const refreshedSession = await forceTokenRefresh();
            if (!refreshedSession) {
              setAuthError('Google tokens expired and refresh failed. Please sign in again.');
            }
          } else {
            console.log('[AUTH] Google session validated with valid tokens');
            scheduleTokenRefresh(session);
          }
        }
      } catch (error) {
        console.error('[AUTH] Error during auth initialization:', error);
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
      cleanup();
    };
  }, []); // Empty dependency array is correct

  // Enhanced value with new token management functions
  const value = useMemo(() => ({
    user,
    session,
    loading,
    isGoogleConnected,
    authError,
    signOut,
    refreshSession,
    signInWithGoogle,
    isTokenValid,
    forceTokenRefresh,
    getGoogleOAuthToken: getValidGoogleToken, // Use the enhanced async version
  }), [
    user, 
    session, 
    loading, 
    isGoogleConnected, 
    authError, 
    signOut, 
    refreshSession, 
    signInWithGoogle, 
    isTokenValid, 
    forceTokenRefresh, 
    getValidGoogleToken
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
});

AuthProvider.displayName = 'AuthProvider';
