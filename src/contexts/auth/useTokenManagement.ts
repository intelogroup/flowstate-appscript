
import { useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
      console.log('[TOKEN_MANAGEMENT] Starting token refresh...');
      
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
        console.warn('[TOKEN_MANAGEMENT] Token refresh succeeded but no session returned');
        setAuthError('Token refresh failed - no session returned');
        return null;
      }

      console.log('[TOKEN_MANAGEMENT] Token refresh successful');
      
      // Save refreshed tokens in background (non-blocking)
      setTimeout(async () => {
        try {
          const { AuthTokenService } = await import('@/services/authTokenService');
          await AuthTokenService.saveTokensBackground(data.session);
          console.log('[TOKEN_MANAGEMENT] Background: Refreshed tokens saved');
        } catch (saveError) {
          console.error('[TOKEN_MANAGEMENT] Background: Failed to save refreshed tokens (non-critical):', saveError);
        }
      }, 0);
      
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
      console.log('[TOKEN_MANAGEMENT] Getting valid token...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[TOKEN_MANAGEMENT] Error getting session for token:', error);
        return null;
      }
      
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

      console.log('[TOKEN_MANAGEMENT] Session valid, returning token');
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
