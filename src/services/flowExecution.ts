
import { FlowConfig, FlowExecutionResult } from './types/flowTypes';

export class FlowExecutionService {
  private static readonly EDGE_FUNCTION_URL = 'https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/apps-script-proxy';

  static async executeFlow(
    flowId: string,
    userConfig: FlowConfig
  ): Promise<FlowExecutionResult> {
    try {
      console.log('[FLOW EXECUTION] 🚀 Executing flow with shared secret authentication');
      console.log('[FLOW EXECUTION] 📋 Flow config:', {
        flowId,
        userId: userConfig.userId,
        flowName: userConfig.flowName,
        driveFolder: userConfig.driveFolder,
        senders: userConfig.senders
      });
      
      // Validate required configuration
      this.validateConfig(userConfig);

      const payload = this.buildPayload(flowId, userConfig);

      console.log('[FLOW EXECUTION] 📤 Sending payload:', {
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

      console.log('[FLOW EXECUTION] 📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FLOW EXECUTION] ❌ HTTP error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return this.processResult(result);

    } catch (error) {
      console.error('[FLOW EXECUTION] 💥 Flow execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private static validateConfig(userConfig: FlowConfig) {
    if (!userConfig.userId) {
      throw new Error('User ID is required for flow execution');
    }
    if (!userConfig.driveFolder) {
      throw new Error('Drive folder is required for flow execution');
    }
    if (!userConfig.flowName) {
      throw new Error('Flow name is required for flow execution');
    }
  }

  private static buildPayload(flowId: string, userConfig: FlowConfig) {
    return {
      action: 'process_gmail_flow',
      user_id: userConfig.userId,
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
  }

  private static processResult(result: any): FlowExecutionResult {
    console.log('[FLOW EXECUTION] 📊 Response received:', {
      success: result.success,
      hasAppsScriptResponse: !!result.apps_script_response,
      authMethod: result.auth_method,
      userEmail: result.user_email
    });

    const appsScriptData = result.apps_script_response || result;
    
    if (result.success && appsScriptData.status === 'success') {
      console.log('[FLOW EXECUTION] ✅ Success:', {
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
        }
      };
    } else if (appsScriptData.status === 'error') {
      console.error('[FLOW EXECUTION] ❌ Apps Script error:', appsScriptData.message);
      return {
        success: false,
        error: appsScriptData.message || 'Apps Script execution failed'
      };
    } else {
      console.error('[FLOW EXECUTION] ❌ Unexpected response:', {
        resultSuccess: result.success,
        appsScriptStatus: appsScriptData.status,
        message: appsScriptData.message || result.error
      });
      return {
        success: false,
        error: result.error || appsScriptData.message || 'Unknown execution error'
      };
    }
  }

  static async checkAppsScriptHealth(): Promise<boolean> {
    try {
      console.log('[FLOW EXECUTION] 🏥 Checking Apps Script health...');
      
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

      console.log('[FLOW EXECUTION] 🏥 Health check response:', response.status);
      
      if (!response.ok) {
        console.error('[FLOW EXECUTION] 🏥 Health check failed:', response.status);
        return false;
      }

      const result = await response.json();
      console.log('[FLOW EXECUTION] 🏥 Health check result:', result.success);
      return result.success === true;

    } catch (error) {
      console.error('[FLOW EXECUTION] 🏥 Health check error:', error);
      return false;
    }
  }
}
