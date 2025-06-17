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
    googleTokens?: GoogleTokens
  ): Promise<FlowExecutionResult> {
    try {
      console.log('[FLOW SERVICE] Executing flow with enhanced token management');
      console.log('[FLOW SERVICE] Flow config:', {
        flowId,
        userId: userConfig.userId,
        flowName: userConfig.flowName,
        hasGoogleTokens: !!googleTokens
      });
      
      const payload = {
        action: 'process_gmail_flow',
        userConfig,
        user_id: userConfig.userId, // Pass user_id for token retrieval
        // Include tokens if available, but Apps Script proxy will try to get saved tokens if these are missing
        auth_token: googleTokens?.provider_token || googleTokens?.access_token,
        access_token: googleTokens?.access_token,
        googleTokens: googleTokens ? {
          access_token: googleTokens.access_token,
          refresh_token: googleTokens.refresh_token || '',
          provider_token: googleTokens.provider_token || ''
        } : undefined,
        debug_info: {
          request_id: `flow-${flowId}-${Date.now()}`,
          supabase_timestamp: new Date().toISOString(),
          auth_method: 'enhanced-token-management',
          timeout_config: 90000,
          request_source: 'flow-service-v2',
          has_session_tokens: !!googleTokens,
          user_id: userConfig.userId
        }
      };

      console.log('[FLOW SERVICE] Final payload being sent:', {
        action: payload.action,
        userId: payload.user_id,
        hasUserConfig: !!payload.userConfig,
        hasGoogleTokens: !!payload.googleTokens,
        hasAccessToken: !!payload.access_token,
        hasAuthToken: !!payload.auth_token,
        payloadSize: JSON.stringify(payload).length
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add Authorization header if we have tokens
      const primaryToken = googleTokens?.provider_token || googleTokens?.access_token;
      if (primaryToken) {
        headers['Authorization'] = `Bearer ${primaryToken}`;
      }

      const response = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers,
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
