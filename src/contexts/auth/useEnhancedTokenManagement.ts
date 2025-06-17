
import { useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthTokenService } from '@/services/authTokenService';

export const useEnhancedTokenManagement = (
  setSession: (session: Session | null) => void,
  setUser: (user: User | null) => void,
  setAuthError: (error: string | null) => void
) => {
  // Refs to prevent race conditions
  const refreshPromiseRef = useRef<Promise<Session | null> | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const forceTokenRefresh = useCallback(async (): Promise<Session | null> => {
    // Prevent concurrent refresh attempts
    if (refreshPromiseRef.current) {
      console.log('[AUTH] Refresh already in progress, waiting...');
      return await refreshPromiseRef.current;
    }

    const refreshPromise = (async (): Promise<Session | null> => {
      try {
        console.log('[AUTH] Starting enhanced token refresh...');
        
        const { data, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error('[AUTH] Token refresh failed:', error);
          
          // Handle specific refresh errors
          if (error.message?.includes('refresh_token_not_found') || 
              error.message?.includes('invalid_grant')) {
            console.log('[AUTH] Refresh token invalid, user needs to re-authenticate');
            setAuthError('Session expired. Please sign in again.');
            return null;
          }
          
          setAuthError(`Token refresh failed: ${error.message}`);
          return null;
        }

        if (!data.session) {
          console.error('[AUTH] No session returned from refresh');
          setAuthError('Token refresh failed - no session returned');
          return null;
        }

        console.log('[AUTH] Token refresh successful', {
          hasAccessToken: !!data.session.access_token,
          hasProviderToken: !!data.session.provider_token,
          expiresAt: new Date((data.session.expires_at || 0) * 1000).toISOString()
        });
        
        // Save refreshed tokens to database
        try {
          await AuthTokenService.saveTokens(data.session);
        } catch (saveError) {
          console.error('[AUTH] Failed to save refreshed tokens:', saveError);
          // Don't fail the refresh for this, just log it
        }
        
        setSession(data.session);
        setUser(data.session.user);
        setAuthError(null);
        return data.session;

      } catch (error) {
        console.error('[AUTH] Critical error during token refresh:', error);
        setAuthError('Token refresh failed - please sign in again');
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = refreshPromise;
    return await refreshPromise;
  }, [setSession, setUser, setAuthError]);

  const getValidGoogleToken = useCallback(async (): Promise<string | null> => {
    try {
      // Get current session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        console.log('[AUTH] No session found for token extraction');
        return null;
      }

      // Check if session expires soon (5-minute buffer)
      const now = Date.now() / 1000;
      const expiresAt = currentSession.expires_at || 0;
      const bufferTime = 300; // 5 minutes

      if (expiresAt <= now + bufferTime) {
        console.log('[AUTH] Session expires soon, refreshing before token extraction...');
        const refreshedSession = await forceTokenRefresh();
        if (!refreshedSession) {
          return null;
        }
        // Use refreshed session for token extraction
        return refreshedSession.provider_token || refreshedSession.access_token || null;
      }

      // Session is valid, extract token
      const token = currentSession.provider_token || currentSession.access_token;
      
      console.log('[AUTH] Extracted Google token:', {
        hasProviderToken: !!currentSession.provider_token,
        hasAccessToken: !!currentSession.access_token,
        usingToken: currentSession.provider_token ? 'provider_token' : 'access_token',
        tokenLength: token?.length || 0
      });

      return token || null;
    } catch (error) {
      console.error('[AUTH] Error getting valid Google token:', error);
      return null;
    }
  }, [forceTokenRefresh]);

  const ensureValidSession = useCallback(async (): Promise<Session | null> => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        console.log('[AUTH] No session found');
        return null;
      }

      // Check if session expires soon (5-minute buffer)
      const now = Date.now() / 1000;
      const expiresAt = currentSession.expires_at || 0;
      const bufferTime = 300; // 5 minutes

      if (expiresAt <= now + bufferTime) {
        console.log('[AUTH] Session expires soon, refreshing...', {
          expiresAt,
          now,
          timeUntilExpiry: expiresAt - now
        });
        
        return await forceTokenRefresh();
      }

      return currentSession;
    } catch (error) {
      console.error('[AUTH] Error ensuring valid session:', error);
      throw error;
    }
  }, [forceTokenRefresh]);

  const scheduleTokenRefresh = useCallback((session: Session | null) => {
    // Clear existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    if (!session?.expires_at) return;

    const now = Date.now() / 1000;
    const expiresAt = session.expires_at;
    
    // Refresh 10 minutes before expiration (more aggressive)
    const refreshTime = (expiresAt - now - 600) * 1000;
    
    if (refreshTime > 0 && refreshTime < 24 * 60 * 60 * 1000) { // Don't set timeouts longer than 24h
      refreshTimeoutRef.current = setTimeout(() => {
        console.log('[AUTH] Auto-refreshing session (scheduled)...');
        forceTokenRefresh().catch(error => {
          console.error('[AUTH] Scheduled refresh failed:', error);
        });
      }, refreshTime);
      
      console.log('[AUTH] Scheduled token refresh in', Math.round(refreshTime / 1000 / 60), 'minutes');
    } else if (refreshTime <= 0) {
      // Token is already expired or expires very soon
      console.log('[AUTH] Token expired or expires very soon, refreshing immediately...');
      forceTokenRefresh().catch(console.error);
    }
  }, [forceTokenRefresh]);

  const cleanup = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  return {
    forceTokenRefresh,
    getValidGoogleToken,
    ensureValidSession,
    scheduleTokenRefresh,
    cleanup
  };
};
