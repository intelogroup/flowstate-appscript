
import { useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthTokenService } from '@/services/authTokenService';

interface UseTokenManagementProps {
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setAuthError: (error: string | null) => void;
}

export const useTokenManagement = ({
  setSession,
  setUser,
  setAuthError
}: UseTokenManagementProps) => {
  const refreshTokens = useCallback(async (): Promise<Session | null> => {
    try {
      console.log('[TOKEN_MANAGEMENT] Refreshing session...');
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[TOKEN_MANAGEMENT] Refresh failed:', error);
        if (error.message?.includes('refresh_token_not_found')) {
          setAuthError('Session expired. Please sign in again.');
          return null;
        }
        setAuthError(`Token refresh failed: ${error.message}`);
        return null;
      }

      if (!data.session) {
        setAuthError('Token refresh failed - no session returned');
        return null;
      }

      // Save refreshed tokens
      try {
        await AuthTokenService.saveTokens(data.session);
      } catch (saveError) {
        console.error('[TOKEN_MANAGEMENT] Failed to save refreshed tokens:', saveError);
      }
      
      setSession(data.session);
      setUser(data.session.user);
      setAuthError(null);
      return data.session;
    } catch (error) {
      console.error('[TOKEN_MANAGEMENT] Critical refresh error:', error);
      setAuthError('Token refresh failed - please sign in again');
      return null;
    }
  }, [setSession, setUser, setAuthError]);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('[TOKEN_MANAGEMENT] No session found');
        return null;
      }

      // Check if session expires soon (5-minute buffer)
      const now = Date.now() / 1000;
      const expiresAt = session.expires_at || 0;
      const bufferTime = 300;

      if (expiresAt <= now + bufferTime) {
        console.log('[TOKEN_MANAGEMENT] Session expires soon, refreshing...');
        const refreshedSession = await refreshTokens();
        return refreshedSession?.provider_token || refreshedSession?.access_token || null;
      }

      return session.provider_token || session.access_token || null;
    } catch (error) {
      console.error('[TOKEN_MANAGEMENT] Error getting valid token:', error);
      return null;
    }
  }, [refreshTokens]);

  return {
    refreshTokens,
    getValidToken
  };
};
