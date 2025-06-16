
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGoogleConnected: boolean;
  authError: string | null;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

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

  // Enhanced Google connection check with detailed logging
  const isGoogleConnected = useMemo(() => {
    if (!session || !session.user) {
      console.log('[AUTH] No session or user available');
      return false;
    }
    
    const hasGoogleProvider = session.user.app_metadata?.provider === 'google';
    const hasProviderToken = !!session.provider_token;
    const hasAccessToken = !!session.access_token;
    
    console.log('[AUTH] Google connection detailed check:', {
      hasGoogleProvider,
      hasProviderToken,
      hasAccessToken,
      provider: session.user.app_metadata?.provider,
      providerTokenLength: session.provider_token?.length || 0,
      accessTokenLength: session.access_token?.length || 0,
      sessionKeys: Object.keys(session),
      // Log first 20 chars of tokens for debugging (safe)
      providerTokenStart: session.provider_token?.substring(0, 20) || 'none',
      accessTokenStart: session.access_token?.substring(0, 20) || 'none'
    });
    
    // For Google OAuth, we need either provider_token or access_token
    const isConnected = hasGoogleProvider && (hasProviderToken || hasAccessToken);
    
    if (!isConnected && hasGoogleProvider) {
      console.warn('[AUTH] Google provider detected but missing OAuth tokens');
      setAuthError('Google authentication incomplete - missing OAuth tokens. Please sign in again.');
    }
    
    return isConnected;
  }, [session]);

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
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      console.log('[AUTH] Attempting to refresh session...');
      setAuthError(null);
      
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('[AUTH] Error refreshing session:', error);
        setAuthError('Failed to refresh session. Please sign in again.');
        return;
      }
      
      if (data.session) {
        console.log('[AUTH] Session refreshed successfully');
        console.log('[AUTH] Refreshed session tokens:', {
          hasAccessToken: !!data.session.access_token,
          hasProviderToken: !!data.session.provider_token,
          hasRefreshToken: !!data.session.refresh_token,
          provider: data.session.user?.app_metadata?.provider,
          tokenLengths: {
            access: data.session.access_token?.length || 0,
            provider: data.session.provider_token?.length || 0,
            refresh: data.session.refresh_token?.length || 0
          }
        });
        setSession(data.session);
        setUser(data.session.user);
        setAuthError(null);
      } else {
        console.log('[AUTH] No session data returned from refresh');
        setAuthError('Session refresh failed. Please sign in again.');
      }
    } catch (error) {
      console.error('[AUTH] Error refreshing session:', error);
      setAuthError('Session refresh failed. Please sign in again.');
    }
  }, []);

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
  }, []);

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
          providerTokenPreview: session?.provider_token?.substring(0, 20) || 'none'
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

        // Enhanced Google token validation
        if (session && session.user?.app_metadata?.provider === 'google') {
          if (!session.provider_token && !session.access_token) {
            console.error('[AUTH] Google session exists but missing all OAuth tokens');
            setAuthError('Google authentication incomplete. Please sign in again to get proper access tokens.');
          } else {
            console.log('[AUTH] Google session validated with available tokens');
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
        refreshSession();
      }, refreshTime);

      return () => clearTimeout(timeoutId);
    }
  }, [session?.expires_at, refreshSession]);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    isGoogleConnected,
    authError,
    signOut,
    refreshSession,
    signInWithGoogle,
  }), [user, session, loading, isGoogleConnected, authError, signOut, refreshSession, signInWithGoogle]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
});

AuthProvider.displayName = 'AuthProvider';
