
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType } from './auth/types';
import { useTokenValidation } from './auth/useTokenValidation';
import { useTokenRefresh } from './auth/useTokenRefresh';
import { useGoogleConnection } from './auth/useGoogleConnection';
import { useAuthActions } from './auth/useAuthActions';

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

  const { isTokenValid, getGoogleOAuthToken } = useTokenValidation(session);
  const { forceTokenRefresh } = useTokenRefresh(setSession, setUser, setAuthError);
  const { isGoogleConnected } = useGoogleConnection(session, isTokenValid, setAuthError);
  const { signInWithGoogle, refreshSession, signOut } = useAuthActions(
    setAuthError,
    setLoading,
    setSession,
    setUser,
    forceTokenRefresh
  );

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener with enhanced token debugging
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        console.log('[AUTH] Auth state change:', event);
        console.log('[AUTH] Session detailed analysis:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          provider: session?.user?.app_metadata?.provider,
          hasAccessToken: !!session?.access_token,
          hasProviderToken: !!session?.provider_token,
          hasRefreshToken: !!session?.refresh_token,
          sessionKeys: session ? Object.keys(session) : [],
          userKeys: session?.user ? Object.keys(session.user) : [],
          // Safe token previews for debugging
          accessTokenPreview: session?.access_token?.substring(0, 20) || 'none',
          providerTokenPreview: session?.provider_token?.substring(0, 20) || 'none',
          expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'none'
        });
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Enhanced auth event handling
        if (event === 'SIGNED_IN' && session) {
          setAuthError(null);
          console.log('[AUTH] User signed in successfully');
          
          // Validate Google OAuth tokens immediately after sign-in
          if (session.user?.app_metadata?.provider === 'google') {
            if (!session.provider_token && !session.access_token) {
              console.error('[AUTH] Google sign-in completed but missing OAuth tokens!');
              setAuthError('Google authentication incomplete - missing access tokens. Please try signing in again.');
            } else {
              console.log('[AUTH] Google OAuth tokens validated successfully');
            }
          }
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('[AUTH] User signed out');
          setAuthError(null);
        }

        if (event === 'TOKEN_REFRESHED') {
          console.log('[AUTH] Token refreshed successfully');
          setAuthError(null);
        }

        // Only set loading to false after the first auth state change
        if (loading) {
          setLoading(false);
        }
      }
    );

    // Check for existing session with enhanced debugging
    const initializeAuth = async () => {
      try {
        console.log('[AUTH] Initializing auth...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (error) {
          console.error('[AUTH] Error getting session:', error);
          setAuthError('Failed to get session');
          setLoading(false);
          return;
        }

        console.log('[AUTH] Initial session comprehensive check:', {
          hasSession: !!session,
          provider: session?.user?.app_metadata?.provider,
          hasAccessToken: !!session?.access_token,
          hasProviderToken: !!session?.provider_token,
          hasRefreshToken: !!session?.refresh_token,
          expiresAt: session?.expires_at,
          tokenTypes: session ? Object.keys(session).filter(key => key.includes('token')) : [],
          // Preview tokens safely
          accessTokenStart: session?.access_token?.substring(0, 20) || 'none',
          providerTokenStart: session?.provider_token?.substring(0, 20) || 'none'
        });
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Enhanced Google token validation with auto-refresh
        if (session && session.user?.app_metadata?.provider === 'google') {
          const tokenValid = session.expires_at ? session.expires_at > (Date.now() / 1000) + 300 : false;
          
          if (!session.provider_token && !session.access_token) {
            console.error('[AUTH] Google session exists but missing all OAuth tokens');
            setAuthError('Google authentication incomplete. Please sign in again to get proper access tokens.');
          } else if (!tokenValid) {
            console.log('[AUTH] Google tokens present but expired, attempting auto-refresh...');
            const refreshSuccess = await forceTokenRefresh();
            if (!refreshSuccess) {
              setAuthError('Google tokens expired and refresh failed. Please sign in again.');
            }
          } else {
            console.log('[AUTH] Google session validated with valid tokens');
          }
        }
      } catch (error) {
        console.error('[AUTH] Error during auth initialization:', error);
        if (mounted) {
          setAuthError('Authentication initialization failed');
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array is correct here

  // Enhanced auto-refresh tokens before they expire
  useEffect(() => {
    if (!session?.expires_at) return;

    const now = Date.now() / 1000;
    const expiresAt = session.expires_at;
    
    // Refresh 5 minutes before expiration
    const refreshTime = (expiresAt - now - 300) * 1000;
    
    console.log('[AUTH] Token expiration check:', {
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      now: new Date(now * 1000).toISOString(),
      refreshInMs: refreshTime,
      willAutoRefresh: refreshTime > 0
    });
    
    if (refreshTime > 0) {
      const timeoutId = setTimeout(() => {
        console.log('[AUTH] Auto-refreshing session before expiration...');
        forceTokenRefresh();
      }, refreshTime);

      return () => clearTimeout(timeoutId);
    }
  }, [session?.expires_at, forceTokenRefresh]);

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
    getGoogleOAuthToken,
  }), [user, session, loading, isGoogleConnected, authError, signOut, refreshSession, signInWithGoogle, isTokenValid, forceTokenRefresh, getGoogleOAuthToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
});

AuthProvider.displayName = 'AuthProvider';
