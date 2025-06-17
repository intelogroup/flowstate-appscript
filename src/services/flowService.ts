import { supabase } from '@/integrations/supabase/client';

export interface FlowConfig {
  senders?: string;
  emailFilter?: string;
  driveFolder: string;
  fileTypes: string[];
  userId: string;
  flowName: string;
  maxEmails?: number;
  enableDebugMode?: boolean;
}

export interface FlowExecutionResult {
  success: boolean;
  data?: {
    attachments: number;
    processedEmails: number;
    emailsFound: number;
    performance_metrics?: {
      total_duration: number;
    };
    debugInfo?: any;
  };
  error?: string;
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
    userConfig: FlowConfig
  ): Promise<FlowExecutionResult> {
    try {
      console.log('[FLOW SERVICE] Executing flow with simplified authentication');
      console.log('[FLOW SERVICE] Flow config:', {
        flowId,
        userId: userConfig.userId,
        flowName: userConfig.flowName
      });
      
      const payload = {
        action: 'process_gmail_flow',
        user_id: userConfig.userId, // Pass user_id so edge function can get user email
        userConfig: {
          senders: userConfig.senders || userConfig.emailFilter,
          driveFolder: userConfig.driveFolder,
          fileTypes: userConfig.fileTypes,
          flowName: userConfig.flowName,
          maxEmails: userConfig.maxEmails || 10,
          enableDebugMode: true
        },
        debug_info: {
          request_id: `flow-${flowId}-${Date.now()}`,
          auth_method: 'shared-secret',
          request_source: 'flow-service-simplified'
        }
      };

      console.log('[FLOW SERVICE] Sending payload with shared secret auth');

      const response = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
