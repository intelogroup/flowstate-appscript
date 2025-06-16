
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGoogleConnected: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
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

  // Check if user has Google authentication with valid tokens
  const isGoogleConnected = useMemo(() => !!(
    session?.provider_token && 
    session?.user?.app_metadata?.provider === 'google'
  ), [session?.provider_token, session?.user?.app_metadata?.provider]);

  const refreshSession = useCallback(async () => {
    try {
      console.log('[AUTH] Attempting to refresh session...');
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('[AUTH] Error refreshing session:', error);
        return;
      }
      
      if (data.session) {
        console.log('[AUTH] Session refreshed successfully');
        setSession(data.session);
        setUser(data.session.user);
      } else {
        console.log('[AUTH] No session data returned from refresh');
      }
    } catch (error) {
      console.error('[AUTH] Error refreshing session:', error);
    }
  }, []);

  const signOut = useCallback(async () => {
    console.log('[AUTH] Signing out user...');
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('[AUTH] Error during sign out:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let refreshTimeoutId: NodeJS.Timeout | null = null;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        console.log('[AUTH] Auth state change:', event, session?.user?.app_metadata?.provider);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Only set loading to false after the first auth state change
        if (loading) {
          setLoading(false);
        }

        // Handle specific auth events
        if (session && event === 'SIGNED_IN') {
          console.log('[AUTH] User signed in with provider:', session.user?.app_metadata?.provider);
          console.log('[AUTH] Provider token available:', !!session.provider_token);
          
          if (session.provider_token) {
            console.log('[AUTH] Google access token present');
          }
        }

        if (event === 'TOKEN_REFRESHED') {
          console.log('[AUTH] Token refreshed successfully');
        }

        if (event === 'SIGNED_OUT') {
          console.log('[AUTH] User signed out');
        }
      }
    );

    // Check for existing session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        console.log('[AUTH] Initial session check:', session?.user?.app_metadata?.provider);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // If we have a session but no provider token, try to refresh
        if (session && !session.provider_token && session.user?.app_metadata?.provider === 'google') {
          console.log('[AUTH] Session exists but no provider token, attempting refresh...');
          // Use setTimeout to avoid potential auth loop
          setTimeout(() => {
            if (mounted) refreshSession();
          }, 100);
        }
      } catch (error) {
        console.error('[AUTH] Error during auth initialization:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (refreshTimeoutId) {
        clearTimeout(refreshTimeoutId);
      }
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
    signOut,
    refreshSession,
  }), [user, session, loading, isGoogleConnected, signOut, refreshSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
});

AuthProvider.displayName = 'AuthProvider';
