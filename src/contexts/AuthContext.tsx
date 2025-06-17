
import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { AuthContextType } from './auth/types';
import { useTokenValidation } from './auth/useTokenValidation';
import { useGoogleConnection } from './auth/useGoogleConnection';
import { useAuthActions } from './auth/useAuthActions';
import { useTokenManagement } from './auth/useTokenManagement';
import { useAuthStateListener } from './auth/useAuthStateListener';

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

  // Failsafe: ensure loading never stays true indefinitely
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[AUTH_CONTEXT] Loading timeout reached, forcing loading to false');
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [loading]);

  // Modular hooks for better separation of concerns
  const { refreshTokens, getValidToken } = useTokenManagement({
    setSession,
    setUser,
    setAuthError
  });

  useAuthStateListener({
    setSession,
    setUser,
    setAuthError,
    setLoading
  });

  const { isTokenValid, getGoogleOAuthToken } = useTokenValidation(session);
  const { isGoogleConnected } = useGoogleConnection(session, isTokenValid, setAuthError);
  const { signInWithGoogle, refreshSession, signOut } = useAuthActions(
    setAuthError,
    setLoading,
    setSession,
    setUser,
    refreshTokens
  );

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
    forceTokenRefresh: refreshTokens,
    getGoogleOAuthToken: getValidToken,
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
    refreshTokens, 
    getValidToken
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
});

AuthProvider.displayName = 'AuthProvider';
