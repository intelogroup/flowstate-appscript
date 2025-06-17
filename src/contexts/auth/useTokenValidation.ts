
import { useCallback } from 'react';
import { Session } from '@supabase/supabase-js';

export const useTokenValidation = (session: Session | null) => {
  const isTokenValid = useCallback(() => {
    if (!session?.expires_at) {
      console.log('[AUTH] No session or expiration time found');
      return false;
    }
    
    const currentTime = Date.now() / 1000;
    const expiresAt = session.expires_at;
    const timeUntilExpiry = expiresAt - currentTime;
    const isValid = timeUntilExpiry > 300; // 5 minute buffer
    
    console.log('[AUTH] Token validity check:', {
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      currentTime: new Date(currentTime * 1000).toISOString(),
      timeUntilExpiryMinutes: Math.round(timeUntilExpiry / 60),
      isValid,
      hasProviderToken: !!session.provider_token,
      hasAccessToken: !!session.access_token
    });
    
    return isValid;
  }, [session]);

  const getGoogleOAuthToken = useCallback((): string | null => {
    if (!session) {
      console.log('[AUTH] No session available for token extraction');
      return null;
    }

    // Prefer provider_token (original Google OAuth token) but fall back to access_token
    const token = session.provider_token || session.access_token;
    
    console.log('[AUTH] Token extraction:', {
      hasProviderToken: !!session.provider_token,
      hasAccessToken: !!session.access_token,
      usingToken: session.provider_token ? 'provider_token' : 'access_token',
      tokenLength: token?.length || 0
    });

    return token || null;
  }, [session]);

  return { isTokenValid, getGoogleOAuthToken };
};
