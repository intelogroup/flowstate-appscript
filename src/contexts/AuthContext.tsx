
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

  // Check if user has Google authentication with valid tokens
  const isGoogleConnected = useMemo(() => {
    if (!session || !session.user) return false;
    
    const hasGoogleProvider = session.user.app_metadata?.provider === 'google';
    const hasProviderToken = !!session.provider_token;
    const hasAccessToken = !!session.access_token;
    
    console.log('[AUTH] Google connection check:', {
      hasGoogleProvider,
      hasProviderToken,
      hasAccessToken,
      provider: session.user.app_metadata?.provider,
      tokenPresent: !!session.provider_token
    });
    
    return hasGoogleProvider && (hasProviderToken || hasAccessToken);
  }, [session]);

  const signInWithGoogle = useCallback(async () => {
    try {
      setAuthError(null);
      setLoading(true);
      
      console.log('[AUTH] Starting Google OAuth sign-in...');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/app`,
          scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.file'
        }
      });

      if (error) {
        console.error('[AUTH] Google OAuth error:', error);
        setAuthError(error.message);
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
        console.log('[AUTH] New session tokens:', {
          hasAccessToken: !!data.session.access_token,
          hasProviderToken: !!data.session.provider_token,
          hasRefreshToken: !!data.session.refresh_token
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

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        console.log('[AUTH] Auth state change:', event);
        console.log('[AUTH] Session details:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          provider: session?.user?.app_metadata?.provider,
          hasAccessToken: !!session?.access_token,
          hasProviderToken: !!session?.provider_token,
          hasRefreshToken: !!session?.refresh_token
        });
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Clear any auth errors on successful sign in
        if (event === 'SIGNED_IN' && session) {
          setAuthError(null);
          console.log('[AUTH] User signed in successfully');
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

    // Check for existing session
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

        console.log('[AUTH] Initial session check:', {
          hasSession: !!session,
          provider: session?.user?.app_metadata?.provider,
          hasTokens: !!(session?.access_token || session?.provider_token)
        });
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // If we have a session but missing Google tokens, show error
        if (session && session.user?.app_metadata?.provider === 'google' && !session.provider_token && !session.access_token) {
          console.warn('[AUTH] Google session exists but missing provider tokens');
          setAuthError('Google authentication incomplete. Please sign in again.');
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

  // Auto-refresh tokens before they expire
  useEffect(() => {
    if (!session?.expires_at) return;

    const now = Date.now() / 1000;
    const expiresAt = session.expires_at;
    
    // Refresh 5 minutes before expiration
    const refreshTime = (expiresAt - now - 300) * 1000;
    
    if (refreshTime > 0) {
      const timeoutId = setTimeout(() => {
        console.log('[AUTH] Auto-refreshing session...');
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
