
import { useMemo } from 'react';
import { Session } from '@supabase/supabase-js';

export const useGoogleConnection = (
  session: Session | null,
  isTokenValid: () => boolean,
  setAuthError: (error: string | null) => void
) => {
  const isGoogleConnected = useMemo(() => {
    if (!session || !session.user) {
      console.log('[AUTH] No session or user available');
      return false;
    }
    
    const hasGoogleProvider = session.user.app_metadata?.provider === 'google';
    const hasProviderToken = !!session.provider_token;
    const hasAccessToken = !!session.access_token;
    const tokenIsValid = isTokenValid();
    
    console.log('[AUTH] Google connection detailed check:', {
      hasGoogleProvider,
      hasProviderToken,
      hasAccessToken,
      tokenIsValid,
      provider: session.user.app_metadata?.provider,
      providerTokenLength: session.provider_token?.length || 0,
      accessTokenLength: session.access_token?.length || 0,
      sessionKeys: Object.keys(session),
      // Log first 20 chars of tokens for debugging (safe)
      providerTokenStart: session.provider_token?.substring(0, 20) || 'none',
      accessTokenStart: session.access_token?.substring(0, 20) || 'none'
    });
    
    // For Google OAuth, we need provider AND at least one valid token AND valid expiration
    const isConnected = hasGoogleProvider && (hasProviderToken || hasAccessToken) && tokenIsValid;
    
    if (!isConnected && hasGoogleProvider) {
      if (!tokenIsValid) {
        console.warn('[AUTH] Google provider detected but token expired');
        setAuthError('Google authentication expired - tokens need refresh');
      } else if (!hasProviderToken && !hasAccessToken) {
        console.warn('[AUTH] Google provider detected but missing all OAuth tokens');
        setAuthError('Google authentication incomplete - missing OAuth tokens');
      }
    }
    
    return isConnected;
  }, [session, isTokenValid, setAuthError]);

  return { isGoogleConnected };
};
