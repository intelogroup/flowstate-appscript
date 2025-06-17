
import { FlowConfig, FlowExecutionResult } from './types/flowTypes';

export class FlowExecutionService {
  private static readonly EDGE_FUNCTION_URL = 'https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/apps-script-proxy';

  static async executeFlow(
    flowId: string,
    userConfig: FlowConfig
  ): Promise<FlowExecutionResult> {
    const startTime = Date.now();
    
    try {
      console.log('[FLOW EXECUTION] 🚀 Starting flow execution with configuration:', {
        flowId,
        userId: userConfig.userId,
        flowName: userConfig.flowName,
        driveFolder: userConfig.driveFolder,
        senders: userConfig.senders,
        edgeFunctionUrl: this.EDGE_FUNCTION_URL
      });
      
      // Validate required configuration
      this.validateConfig(userConfig);

      const payload = this.buildPayload(flowId, userConfig);

      console.log('[FLOW EXECUTION] 📤 Sending request to edge function:', {
        url: this.EDGE_FUNCTION_URL,
        method: 'POST',
        payloadAction: payload.action,
        payloadUserId: payload.user_id,
        payloadFlowName: payload.userConfig.flowName,
        payloadDriveFolder: payload.userConfig.driveFolder,
        payloadSenders: payload.userConfig.senders,
        requestId: payload.debug_info.request_id,
        fullPayload: payload
      });

      const response = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('[FLOW EXECUTION] 📥 Received response from edge function:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
          console.error('[FLOW EXECUTION] ❌ Error response body:', errorText);
        } catch (textError) {
          console.error('[FLOW EXECUTION] ❌ Could not read error response body:', textError);
          errorText = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        console.error('[FLOW EXECUTION] ❌ HTTP error details:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          flowId,
          userId: userConfig.userId
        });
        
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      let result;
      try {
        const responseText = await response.text();
        console.log('[FLOW EXECUTION] 📋 Raw response text:', responseText);
        
        result = JSON.parse(responseText);
        console.log('[FLOW EXECUTION] 📊 Parsed response:', result);
      } catch (parseError) {
        console.error('[FLOW EXECUTION] ❌ Failed to parse response as JSON:', parseError);
        throw new Error('Invalid JSON response from server');
      }

      return this.processResult(result);

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[FLOW EXECUTION] 💥 Flow execution failed:', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        flowId,
        userId: userConfig.userId,
        duration: `${duration}ms`
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private static validateConfig(userConfig: FlowConfig) {
    console.log('[FLOW EXECUTION] 🔍 Validating configuration:', userConfig);
    
    if (!userConfig.userId) {
      console.error('[FLOW EXECUTION] ❌ Validation failed: Missing userId');
      throw new Error('User ID is required for flow execution');
    }
    if (!userConfig.driveFolder) {
      console.error('[FLOW EXECUTION] ❌ Validation failed: Missing driveFolder');
      throw new Error('Drive folder is required for flow execution');
    }
    if (!userConfig.flowName) {
      console.error('[FLOW EXECUTION] ❌ Validation failed: Missing flowName');
      throw new Error('Flow name is required for flow execution');
    }
    
    console.log('[FLOW EXECUTION] ✅ Configuration validation passed');
  }

  private static buildPayload(flowId: string, userConfig: FlowConfig) {
    const payload = {
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
    
    console.log('[FLOW EXECUTION] 🔧 Built payload:', payload);
    return payload;
  }

  private static processResult(result: any): FlowExecutionResult {
    console.log('[FLOW EXECUTION] 📊 Processing result:', {
      hasResult: !!result,
      resultSuccess: result?.success,
      hasAppsScriptResponse: !!result?.apps_script_response,
      authMethod: result?.auth_method,
      userEmail: result?.user_email,
      fullResult: result
    });

    const appsScriptData = result.apps_script_response || result;
    
    console.log('[FLOW EXECUTION] 📋 Apps Script data:', {
      hasAppsScriptData: !!appsScriptData,
      appsScriptStatus: appsScriptData?.status,
      appsScriptMessage: appsScriptData?.message,
      appsScriptData: appsScriptData?.data
    });
    
    if (result.success && appsScriptData.status === 'success') {
      const successData = {
        attachments: appsScriptData.data?.attachments || 0,
        processedEmails: appsScriptData.data?.processedEmails || 0,
        emailsFound: appsScriptData.data?.emailsFound || 0
      };
      
      console.log('[FLOW EXECUTION] ✅ Processing successful result:', successData);

      return {
        success: true,
        data: {
          ...successData,
          performance_metrics: result.performance_metrics,
          debugInfo: appsScriptData.data?.debugInfo || result.debug_info
        }
      };
    } else if (appsScriptData.status === 'error') {
      const errorMsg = appsScriptData.message || 'Apps Script execution failed';
      console.error('[FLOW EXECUTION] ❌ Apps Script returned error:', {
        status: appsScriptData.status,
        message: errorMsg,
        fullAppsScriptData: appsScriptData
      });
      
      return {
        success: false,
        error: errorMsg
      };
    } else {
      const errorMsg = result.error || appsScriptData.message || 'Unknown execution error';
      console.error('[FLOW EXECUTION] ❌ Unexpected result format:', {
        resultSuccess: result.success,
        appsScriptStatus: appsScriptData.status,
        errorMessage: errorMsg,
        fullResult: result,
        fullAppsScriptData: appsScriptData
      });
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  static async checkAppsScriptHealth(): Promise<boolean> {
    try {
      console.log('[FLOW EXECUTION] 🏥 Starting Apps Script health check...');
      
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

      console.log('[FLOW EXECUTION] 🏥 Sending health check payload:', payload);

      const response = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('[FLOW EXECUTION] 🏥 Health check response:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });
      
      if (!response.ok) {
        console.error('[FLOW EXECUTION] 🏥 Health check failed with HTTP error:', response.status);
        return false;
      }

      const result = await response.json();
      console.log('[FLOW EXECUTION] 🏥 Health check result:', result);
      
      const isHealthy = result.success === true;
      console.log('[FLOW EXECUTION] 🏥 Health check conclusion:', isHealthy ? 'HEALTHY' : 'UNHEALTHY');
      
      return isHealthy;

    } catch (error) {
      console.error('[FLOW EXECUTION] 🏥 Health check exception:', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      return false;
    }
  }
}
