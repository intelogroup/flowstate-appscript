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
      console.log('[FLOW SERVICE] 🚀 Executing flow with shared secret authentication');
      console.log('[FLOW SERVICE] 📋 Flow config:', {
        flowId,
        userId: userConfig.userId,
        flowName: userConfig.flowName,
        driveFolder: userConfig.driveFolder,
        senders: userConfig.senders
      });
      
      // Validate required configuration
      if (!userConfig.userId) {
        throw new Error('User ID is required for flow execution');
      }

      if (!userConfig.driveFolder) {
        throw new Error('Drive folder is required for flow execution');
      }

      if (!userConfig.flowName) {
        throw new Error('Flow name is required for flow execution');
      }

      const payload = {
        action: 'process_gmail_flow',
        user_id: userConfig.userId, // Pass user_id so edge function can get user email
        userConfig: {
          senders: userConfig.senders || userConfig.emailFilter,
          driveFolder: userConfig.driveFolder,
          fileTypes: userConfig.fileTypes || ['pdf'],
          flowName: userConfig.flowName,
          maxEmails: userConfig.maxEmails || 10,
          enableDebugMode: userConfig.enableDebugMode || true
        },
        debug_info: {
          request_id: `flow-${flowId}-${Date.now()}`,
          auth_method: 'shared-secret',
          request_source: 'flow-service-v2',
          flow_id: flowId
        }
      };

      console.log('[FLOW SERVICE] 📤 Sending payload:', {
        action: payload.action,
        user_id: payload.user_id,
        flowName: payload.userConfig.flowName,
        driveFolder: payload.userConfig.driveFolder,
        senders: payload.userConfig.senders,
        request_id: payload.debug_info.request_id
      });

      const response = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('[FLOW SERVICE] 📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FLOW SERVICE] ❌ HTTP error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('[FLOW SERVICE] 📊 Response received:', {
        success: result.success,
        hasAppsScriptResponse: !!result.apps_script_response,
        authMethod: result.auth_method,
        userEmail: result.user_email
      });

      // Handle the nested apps_script_response structure
      const appsScriptData = result.apps_script_response || result;
      
      // Enhanced status checking
      if (result.success && appsScriptData.status === 'success') {
        console.log('[FLOW SERVICE] ✅ Success:', {
          attachments: appsScriptData.data?.attachments || 0,
          processedEmails: appsScriptData.data?.processedEmails || 0,
          emailsFound: appsScriptData.data?.emailsFound || 0
        });

        return {
          success: true,
          data: {
            attachments: appsScriptData.data?.attachments || 0,
            processedEmails: appsScriptData.data?.processedEmails || 0,
            emailsFound: appsScriptData.data?.emailsFound || 0,
            performance_metrics: result.performance_metrics,
            debugInfo: appsScriptData.data?.debugInfo || result.debug_info
          },
          error: undefined
        };
      } else if (appsScriptData.status === 'error') {
        console.error('[FLOW SERVICE] ❌ Apps Script error:', appsScriptData.message);
        return {
          success: false,
          data: undefined,
          error: appsScriptData.message || 'Apps Script execution failed'
        };
      } else {
        console.error('[FLOW SERVICE] ❌ Unexpected response:', {
          resultSuccess: result.success,
          appsScriptStatus: appsScriptData.status,
          message: appsScriptData.message || result.error
        });
        return {
          success: false,
          data: undefined,
          error: result.error || appsScriptData.message || 'Unknown execution error'
        };
      }

    } catch (error) {
      console.error('[FLOW SERVICE] 💥 Flow execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
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
      console.log('[FLOW SERVICE] 🏥 Checking Apps Script health...');
      
      const payload = {
        action: 'health_check',
        user_id: 'health-check-user',
        userConfig: {
          flowName: 'Health Check',
          driveFolder: 'Health Check',
          fileTypes: ['pdf'],
          maxEmails: 1,
          enableDebugMode: true
        }
      };

      const response = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('[FLOW SERVICE] 🏥 Health check response:', response.status);
      
      if (!response.ok) {
        console.error('[FLOW SERVICE] 🏥 Health check failed:', response.status);
        return false;
      }

      const result = await response.json();
      console.log('[FLOW SERVICE] 🏥 Health check result:', result.success);
      return result.success === true;

    } catch (error) {
      console.error('[FLOW SERVICE] 🏥 Health check error:', error);
      return false;
    }
  }
}
