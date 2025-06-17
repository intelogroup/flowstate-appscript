
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { logNetworkEvent } from "../_shared/network-utils.ts"

export async function getUserEmail(userId: string, supabaseUrl: string, supabaseServiceKey: string, requestId: string): Promise<string | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    logNetworkEvent('FETCHING_USER_EMAIL', {
      user_id: userId,
      request_id: requestId
    });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (profileError) {
      logNetworkEvent('USER_EMAIL_FETCH_ERROR', {
        error: profileError.message,
        user_id: userId,
        request_id: requestId
      });
      return null;
    }

    if (profile?.email) {
      logNetworkEvent('USER_EMAIL_RETRIEVED', {
        user_id: userId,
        request_id: requestId
      });
      return profile.email;
    }

    return null;
  } catch (error) {
    logNetworkEvent('USER_EMAIL_RETRIEVAL_ERROR', {
      error: error.message,
      user_id: userId,
      request_id: requestId
    });
    return null;
  }
}
