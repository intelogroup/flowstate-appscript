
import React, { createContext, useContext, useEffect, useState } from 'react';
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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user has Google authentication with valid tokens
  const isGoogleConnected = !!(
    session?.provider_token && 
    session?.provider === 'google'
  );

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Error refreshing session:', error);
        return;
      }
      
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.provider);
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // If session exists but tokens might be expired, try to refresh
        if (session && event === 'SIGNED_IN') {
          console.log('User signed in with provider:', session.provider);
          console.log('Provider token available:', !!session.provider_token);
          
          // Store token info for debugging
          if (session.provider_token) {
            console.log('Google access token present');
          }
        }

        // Handle token refresh on session recovery
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed successfully');
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.provider);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // If we have a session but no provider token, try to refresh
      if (session && !session.provider_token && session.provider === 'google') {
        console.log('Session exists but no provider token, attempting refresh...');
        refreshSession();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-refresh tokens before they expire
  useEffect(() => {
    if (!session) return;

    const now = Date.now() / 1000;
    const expiresAt = session.expires_at;
    
    if (expiresAt) {
      // Refresh 5 minutes before expiration
      const refreshTime = (expiresAt - now - 300) * 1000;
      
      if (refreshTime > 0) {
        const timeoutId = setTimeout(() => {
          console.log('Auto-refreshing session...');
          refreshSession();
        }, refreshTime);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [session]);

  const signOut = async () => {
    console.log('Signing out user...');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const value = {
    user,
    session,
    loading,
    isGoogleConnected,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
