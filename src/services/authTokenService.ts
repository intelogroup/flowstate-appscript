
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

export interface AuthToken {
  id?: string;
  user_id: string;
  provider: string;
  access_token?: string;
  refresh_token?: string;
  provider_token?: string;
  expires_at?: string;
  created_at?: string;
  updated_at?: string;
}

export class AuthTokenService {
  static async saveTokens(session: Session): Promise<void> {
    if (!session.user?.id) {
      throw new Error('No user ID found in session');
    }

    const tokenData: Partial<AuthToken> = {
      user_id: session.user.id,
      provider: session.user.app_metadata?.provider || 'google',
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      provider_token: session.provider_token,
      expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : undefined
    };

    console.log('[AUTH TOKENS] Saving tokens to database:', {
      user_id: tokenData.user_id,
      provider: tokenData.provider,
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      hasProviderToken: !!tokenData.provider_token,
      expiresAt: tokenData.expires_at
    });

    // Check if tokens already exist for this user and provider
    const { data: existingTokens } = await supabase
      .from('user_auth_tokens')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('provider', tokenData.provider)
      .single();

    if (existingTokens) {
      // Update existing tokens
      const { error } = await supabase
        .from('user_auth_tokens')
        .update(tokenData)
        .eq('id', existingTokens.id);

      if (error) {
        console.error('[AUTH TOKENS] Error updating tokens:', error);
        throw error;
      }

      console.log('[AUTH TOKENS] Tokens updated successfully');
    } else {
      // Insert new tokens
      const { error } = await supabase
        .from('user_auth_tokens')
        .insert([tokenData]);

      if (error) {
        console.error('[AUTH TOKENS] Error saving tokens:', error);
        throw error;
      }

      console.log('[AUTH TOKENS] Tokens saved successfully');
    }
  }

  static async getTokens(userId: string, provider: string = 'google'): Promise<AuthToken | null> {
    const { data, error } = await supabase
      .from('user_auth_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    if (error) {
      console.error('[AUTH TOKENS] Error fetching tokens:', error);
      return null;
    }

    return data;
  }

  static async deleteTokens(userId: string, provider: string = 'google'): Promise<void> {
    const { error } = await supabase
      .from('user_auth_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);

    if (error) {
      console.error('[AUTH TOKENS] Error deleting tokens:', error);
      throw error;
    }

    console.log('[AUTH TOKENS] Tokens deleted successfully');
  }
}
