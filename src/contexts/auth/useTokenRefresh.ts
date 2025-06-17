
import { useCallback, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useTokenRefresh = (
  setSession: (session: Session | null) => void,
  setUser: (user: User | null) => void,
  setAuthError: (error: string | null) => void
) => {
  const forceTokenRefresh = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[AUTH] Force refreshing session...');
      setAuthError(null);
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[AUTH] Force refresh failed:', error);
        setAuthError(`Token refresh failed: ${error.message}`);
        return false;
      }
      
      if (data.session) {
        console.log('[AUTH] Force refresh successful');
        console.log('[AUTH] New session tokens:', {
          hasAccessToken: !!data.session.access_token,
          hasProviderToken: !!data.session.provider_token,
          hasRefreshToken: !!data.session.refresh_token,
          expiresAt: new Date((data.session.expires_at || 0) * 1000).toISOString(),
          tokenLengths: {
            access: data.session.access_token?.length || 0,
            provider: data.session.provider_token?.length || 0,
            refresh: data.session.refresh_token?.length || 0
          }
        });
        
        setSession(data.session);
        setUser(data.session.user);
        setAuthError(null);
        return true;
      } else {
        console.error('[AUTH] Force refresh returned no session');
        setAuthError('Token refresh failed - no session returned');
        return false;
      }
    } catch (error) {
      console.error('[AUTH] Force refresh error:', error);
      setAuthError('Token refresh failed - please sign in again');
      return false;
    }
  }, [setSession, setUser, setAuthError]);

  return { forceTokenRefresh };
};
