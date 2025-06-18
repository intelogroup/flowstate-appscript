
import { FlowConfig, FlowExecutionResult } from './types/flowTypes';
import { supabase } from '@/integrations/supabase/client';

export class FlowExecutionService {
  private static readonly EDGE_FUNCTION_URL = 'https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/apps-script-proxy';
  private static readonly WEBHOOK_URL = 'https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/webhook-handler';

  static async executeFlow(
    flowId: string,
    userConfig: FlowConfig
  ): Promise<FlowExecutionResult> {
    const startTime = Date.now();
    
    try {
      console.log('[FLOW EXECUTION] 🚀 Starting flow execution with webhook integration:', {
        flowId,
        userId: userConfig.userId,
        flowName: userConfig.flowName,
        driveFolder: userConfig.driveFolder,
        senders: userConfig.senders,
        webhookUrl: this.WEBHOOK_URL,
        timestamp: new Date().toISOString()
      });
      
      this.validateConfig(userConfig);

      const payload = this.buildPayload(flowId, userConfig);

      console.log('[FLOW EXECUTION] 🔐 Checking Supabase auth state...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('[FLOW EXECUTION] 🔐 Supabase session details:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        hasAccessToken: !!session?.access_token,
        timestamp: new Date().toISOString()
      });

      if (!session || !session.access_token) {
        console.error('[FLOW EXECUTION] ❌ CRITICAL: No valid Supabase session found');
        throw new Error('Authentication required: No valid session found');
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pa3Jvc25ya2d4bGJic2pkYmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjMwMzcsImV4cCI6MjA2NTU5OTAzN30.mrTrjtKDsS99v87pr64Gt1Rib6JU5V9gIfdly4bl9J0',
        'x-debug-source': 'flow-execution-service-webhook',
        'x-user-agent': navigator.userAgent || 'unknown'
      };

      console.log('[FLOW EXECUTION] 📤 Making request with webhook URL integration:', {
        url: this.EDGE_FUNCTION_URL,
        webhookUrl: this.WEBHOOK_URL,
        payloadAction: payload.action,
        payloadUserId: payload.user_id,
        payloadFlowName: payload.userConfig.flowName,
        hasWebhookUrl: !!payload.webhookUrl,
        timestamp: new Date().toISOString()
      });

      const fetchStartTime = Date.now();

      let response: Response;
      try {
        response = await fetch(this.EDGE_FUNCTION_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        
        const fetchDuration = Date.now() - fetchStartTime;
        console.log('[FLOW EXECUTION] 📥 Fetch completed with webhook integration:', {
          fetchDuration: `${fetchDuration}ms`,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          webhookEnabled: true,
          timestamp: new Date().toISOString()
        });

      } catch (fetchError) {
        const fetchDuration = Date.now() - fetchStartTime;
        console.error('[FLOW EXECUTION] 💥 FETCH ERROR:', {
          fetchDuration: `${fetchDuration}ms`,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          timestamp: new Date().toISOString()
        });
        throw new Error(`Network request failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      }

      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
          console.error('[FLOW EXECUTION] ❌ Error response received:', {
            status: response.status,
            statusText: response.statusText,
            errorText,
            timestamp: new Date().toISOString()
          });
        } catch (textError) {
          errorText = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      let result;
      try {
        const responseText = await response.text();
        console.log('[FLOW EXECUTION] 📋 Raw response received:', {
          responseLength: responseText.length,
          responsePreview: responseText.substring(0, 200),
          timestamp: new Date().toISOString()
        });
        
        result = JSON.parse(responseText);
        console.log('[FLOW EXECUTION] 📊 Response parsed successfully with webhook integration:', {
          hasResult: !!result,
          resultSuccess: result?.success,
          hasError: !!result?.error,
          hasData: !!result?.data,
          webhookIntegrated: true,
          timestamp: new Date().toISOString()
        });
      } catch (parseError) {
        console.error('[FLOW EXECUTION] ❌ Failed to parse response as JSON:', {
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
          timestamp: new Date().toISOString()
        });
        throw new Error('Invalid JSON response from server');
      }

      return this.processResult(result);

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      console.error('[FLOW EXECUTION] 💥 Flow execution failed:', {
        error: errorMsg,
        flowId,
        userId: userConfig.userId,
        duration: `${duration}ms`,
        webhookEnabled: true,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  private static validateConfig(userConfig: FlowConfig) {
    console.log('[FLOW EXECUTION] 🔍 Validating configuration:', userConfig);
    
    if (!userConfig.userId) {
      throw new Error('User ID is required for flow execution');
    }
    if (!userConfig.driveFolder) {
      throw new Error('Drive folder is required for flow execution');
    }
    if (!userConfig.flowName) {
      throw new Error('Flow name is required for flow execution');
    }
    
    console.log('[FLOW EXECUTION] ✅ Configuration validation passed');
  }

  private static buildPayload(flowId: string, userConfig: FlowConfig) {
    const payload = {
      action: 'process_gmail_flow',
      user_id: userConfig.userId,
      webhookUrl: this.WEBHOOK_URL, // Add webhook URL to payload
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
        request_source: 'flow-service-v2-webhook',
        flow_id: flowId,
        webhook_enabled: true
      }
    };
    
    console.log('[FLOW EXECUTION] 🔧 Built payload with webhook integration:', {
      ...payload,
      webhookUrl: this.WEBHOOK_URL,
      hasWebhookUrl: !!payload.webhookUrl
    });
    return payload;
  }

  private static processResult(result: any): FlowExecutionResult {
    console.log('[FLOW EXECUTION] 📊 Processing result with webhook integration:', {
      hasResult: !!result,
      resultSuccess: result?.success,
      hasAppsScriptResponse: !!result?.apps_script_response,
      webhookEnabled: true,
      fullResult: result
    });

    const appsScriptData = result.apps_script_response || result;
    
    if (result.success && appsScriptData.status === 'success') {
      const successData = {
        attachments: appsScriptData.data?.attachments || 0,
        processedEmails: appsScriptData.data?.processedEmails || 0,
        emailsFound: appsScriptData.data?.emailsFound || 0
      };
      
      console.log('[FLOW EXECUTION] ✅ Processing successful result with webhook integration:', successData);

      return {
        success: true,
        data: {
          ...successData,
          performance_metrics: result.performance_metrics,
          debugInfo: appsScriptData.data?.debugInfo || result.debug_info,
          webhookEnabled: true
        }
      };
    } else if (appsScriptData.status === 'error') {
      const errorMsg = appsScriptData.message || 'Apps Script execution failed';
      console.error('[FLOW EXECUTION] ❌ Apps Script returned error:', {
        status: appsScriptData.status,
        message: errorMsg,
        webhookEnabled: true
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
        webhookEnabled: true
      });
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  static async checkAppsScriptHealth(): Promise<boolean> {
    try {
      console.log('[FLOW EXECUTION] 🏥 Starting Apps Script health check with webhook support...');
      
      const payload = {
        action: 'health_check',
        user_id: 'health-check-user',
        webhookUrl: this.WEBHOOK_URL, // Include webhook URL in health check
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

      console.log('[FLOW EXECUTION] 🏥 Health check response with webhook integration:', {
        status: response.status,
        ok: response.ok,
        webhookEnabled: true
      });
      
      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      const isHealthy = result.success === true;
      console.log('[FLOW EXECUTION] 🏥 Health check conclusion with webhook support:', isHealthy ? 'HEALTHY' : 'UNHEALTHY');
      
      return isHealthy;

    } catch (error) {
      console.error('[FLOW EXECUTION] 🏥 Health check exception:', {
        error: error instanceof Error ? error.message : String(error),
        webhookEnabled: true
      });
      return false;
    }
  }
}
