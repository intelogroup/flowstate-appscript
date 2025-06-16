import { supabase } from '@/integrations/supabase/client';

export interface FlowConfig {
  senders?: string; // NEW: V.06 compatible field
  emailFilter?: string; // Legacy field for backward compatibility
  driveFolder: string;
  fileTypes: string[];
  userId: string;
  flowName: string;
  maxEmails?: number;
  enableDebugMode?: boolean;
  showEmailDetails?: boolean;
}

export interface FlowExecutionResult {
  success: boolean;
  data?: {
    attachments: number;
    processedEmails: number;
    emailsFound: number;
    processed?: number;
    performance_metrics?: {
      total_duration: number;
      timeout_used: number;
    };
    debugInfo?: any;
  };
  error?: string;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  provider_token: string;
}

export interface CreateFlowData {
  flowName: string;
  emailFilter: string;
  driveFolder: string;
  fileTypes: string[];
  autoRun: boolean;
  frequency: string;
  userId: string;
}

export class FlowService {
  private static readonly EDGE_FUNCTION_URL = 'https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/apps-script-proxy';

  static async executeFlow(
    flowId: string,
    userConfig: FlowConfig,
    googleTokens: GoogleTokens
  ): Promise<FlowExecutionResult> {
    try {
      console.log('[FLOW SERVICE] Executing flow with V.06 payload structure');
      console.log('[FLOW SERVICE] Google tokens debug:', {
        hasAccessToken: !!googleTokens.access_token,
        hasRefreshToken: !!googleTokens.refresh_token,
        hasProviderToken: !!googleTokens.provider_token,
        accessTokenLength: googleTokens.access_token?.length || 0,
        providerTokenLength: googleTokens.provider_token?.length || 0
      });
      
      // Use provider_token as the primary OAuth token for Apps Script
      const primaryToken = googleTokens.provider_token || googleTokens.access_token;
      
      console.log('[FLOW SERVICE] Using primary token:', {
        tokenType: googleTokens.provider_token ? 'provider_token' : 'access_token',
        tokenLength: primaryToken?.length || 0,
        tokenPreview: primaryToken?.substring(0, 30) + '...'
      });
      
      const payload = {
        action: 'process_gmail_flow',
        userConfig,
        // Apps Script expects the token as 'auth_token' in the payload
        auth_token: primaryToken,
        access_token: primaryToken, // Also include as access_token for compatibility
        googleTokens: {
          access_token: primaryToken,
          refresh_token: googleTokens.refresh_token || '',
          provider_token: googleTokens.provider_token || ''
        },
        debug_info: {
          request_id: `flow-${flowId}-${Date.now()}`,
          supabase_timestamp: new Date().toISOString(),
          auth_method: 'body-based-v6',
          timeout_config: 90000,
          request_source: 'edge-function-enhanced-debug',
          token_debug: {
            primary_token_present: !!primaryToken,
            primary_token_type: googleTokens.provider_token ? 'provider_token' : 'access_token',
            primary_token_length: primaryToken?.length || 0
          }
        }
      };

      console.log('[FLOW SERVICE] Final payload being sent:', {
        action: payload.action,
        hasUserConfig: !!payload.userConfig,
        hasGoogleTokens: !!payload.googleTokens,
        hasAccessToken: !!payload.access_token,
        hasAuthToken: !!payload.auth_token,
        primaryTokenPresent: !!primaryToken,
        primaryTokenLength: primaryToken?.length || 0,
        payloadSize: JSON.stringify(payload).length
      });

      const response = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${primaryToken}` // Use the OAuth token in Authorization header
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[FLOW SERVICE] Response received:', result);

      // Handle the nested apps_script_response structure
      const appsScriptData = result.apps_script_response || result;
      
      // Check if the Apps Script execution was successful
      if (appsScriptData.status === 'success') {
        return {
          success: true,
          data: appsScriptData.data,
          error: undefined
        };
      } else if (appsScriptData.status === 'error') {
        return {
          success: false,
          data: undefined,
          error: appsScriptData.message || 'Apps Script execution failed'
        };
      } else {
        // Handle edge function success but unknown Apps Script status
        return {
          success: false,
          data: undefined,
          error: appsScriptData.message || 'Unknown Apps Script status'
        };
      }

    } catch (error) {
      console.error('[FLOW SERVICE] Flow execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async fetchUserFlows(userId: string) {
    const { data, error } = await supabase
      .from('user_configurations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async createFlow(flowData: CreateFlowData) {
    const { data, error } = await supabase
      .from('user_configurations')
      .insert([{
        flow_name: flowData.flowName,
        email_filter: flowData.emailFilter,
        drive_folder: flowData.driveFolder,
        file_types: flowData.fileTypes,
        auto_run: flowData.autoRun,
        frequency: flowData.frequency,
        user_id: flowData.userId
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteFlow(flowId: string, userId: string) {
    const { error } = await supabase
      .from('user_configurations')
      .delete()
      .eq('id', flowId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  static async checkAppsScriptHealth(): Promise<boolean> {
    try {
      const payload = {
        action: 'health_check'
      };

      const response = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) return false;

      const result = await response.json();
      return result.status === 'success';

    } catch (error) {
      console.error('[FLOW SERVICE] Health check failed:', error);
      return false;
    }
  }
}
