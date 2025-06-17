
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

export interface AuthToken {
  id: string;
  user_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  provider_token: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at?: string;
}

export class AuthTokenService {
  static async saveTokens(session: Session): Promise<void> {
    if (!session.user?.id) {
      throw new Error('No user ID available');
    }

    const tokenData = {
      user_id: session.user.id,
      provider: session.user.app_metadata?.provider || 'unknown',
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      provider_token: session.provider_token,
      expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null
    };

    const { error } = await supabase
      .from('auth_tokens')
      .upsert(tokenData, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('[AUTH_TOKEN_SERVICE] Error saving tokens:', error);
      throw error;
    }

    console.log('[AUTH_TOKEN_SERVICE] Tokens saved successfully');
  }

  static async getTokens(userId: string): Promise<AuthToken | null> {
    const { data, error } = await supabase
      .from('auth_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      console.error('[AUTH_TOKEN_SERVICE] Error fetching tokens:', error);
      throw error;
    }

    return data;
  }

  static async deleteTokens(userId: string): Promise<void> {
    const { error } = await supabase
      .from('auth_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[AUTH_TOKEN_SERVICE] Error deleting tokens:', error);
      throw error;
    }

    console.log('[AUTH_TOKEN_SERVICE] Tokens deleted successfully');
  }
}
