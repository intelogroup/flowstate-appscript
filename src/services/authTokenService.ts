
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

    try {
      const tokenData = {
        user_id: session.user.id,
        provider: session.user.app_metadata?.provider || 'unknown',
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        provider_token: session.provider_token,
        expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null
      };

      console.log('[AUTH_TOKEN_SERVICE] Attempting to save tokens for user:', session.user.id);

      const { error } = await supabase
        .from('user_auth_tokens')
        .upsert(tokenData, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('[AUTH_TOKEN_SERVICE] Error saving tokens:', error);
        throw error;
      }

      console.log('[AUTH_TOKEN_SERVICE] Tokens saved successfully');
    } catch (error) {
      console.error('[AUTH_TOKEN_SERVICE] Critical error in saveTokens:', error);
      // Re-throw to allow caller to handle appropriately
      throw error;
    }
  }

  static async getTokens(userId: string): Promise<AuthToken | null> {
    try {
      const { data, error } = await supabase
        .from('user_auth_tokens')
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

      return data as AuthToken;
    } catch (error) {
      console.error('[AUTH_TOKEN_SERVICE] Critical error in getTokens:', error);
      throw error;
    }
  }

  static async deleteTokens(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_auth_tokens')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('[AUTH_TOKEN_SERVICE] Error deleting tokens:', error);
        throw error;
      }

      console.log('[AUTH_TOKEN_SERVICE] Tokens deleted successfully');
    } catch (error) {
      console.error('[AUTH_TOKEN_SERVICE] Critical error in deleteTokens:', error);
      throw error;
    }
  }

  // Safe background token saving with enhanced error handling
  static async saveTokensBackground(session: Session): Promise<void> {
    try {
      await this.saveTokens(session);
    } catch (error) {
      // Log error but don't throw - this is for background operations
      console.error('[AUTH_TOKEN_SERVICE] Background token save failed (non-critical):', error);
      
      // Could implement retry logic here if needed
      if (error && typeof error === 'object' && 'code' in error) {
        const pgError = error as { code: string; message: string };
        if (pgError.code === '23505') {
          // Unique constraint violation - retry once
          console.log('[AUTH_TOKEN_SERVICE] Retrying background save due to constraint violation...');
          try {
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
            await this.saveTokens(session);
          } catch (retryError) {
            console.error('[AUTH_TOKEN_SERVICE] Background retry also failed:', retryError);
          }
        }
      }
    }
  }
}
