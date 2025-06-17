import { FlowConfig, FlowExecutionResult } from './types/flowTypes';
import { supabase } from '@/integrations/supabase/client';

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
        edgeFunctionUrl: this.EDGE_FUNCTION_URL,
        timestamp: new Date().toISOString()
      });
      
      // Validate required configuration
      this.validateConfig(userConfig);

      const payload = this.buildPayload(flowId, userConfig);

      // Check Supabase auth state before making request
      console.log('[FLOW EXECUTION] 🔐 Checking Supabase auth state...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('[FLOW EXECUTION] 🔐 Supabase session details:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        hasAccessToken: !!session?.access_token,
        accessTokenPreview: session?.access_token ? session.access_token.substring(0, 20) + '...' : 'None',
        sessionError: sessionError?.message,
        expiresAt: session?.expires_at,
        tokenType: session?.token_type,
        timestamp: new Date().toISOString()
      });

      if (!session || !session.access_token) {
        console.error('[FLOW EXECUTION] ❌ CRITICAL: No valid Supabase session found:', {
          hasSession: !!session,
          hasAccessToken: !!session?.access_token,
          sessionError: sessionError?.message,
          timestamp: new Date().toISOString()
        });
        throw new Error('Authentication required: No valid session found');
      }

      // Prepare headers with explicit authorization
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pa3Jvc25ya2d4bGJic2pkYmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjMwMzcsImV4cCI6MjA2NTU5OTAzN30.mrTrjtKDsS99v87pr64Gt1Rib6JU5V9gIfdly4bl9J0',
        'x-debug-source': 'flow-execution-service',
        'x-user-agent': navigator.userAgent || 'unknown'
      };

      console.log('[FLOW EXECUTION] 📤 Preparing request with detailed headers:', {
        url: this.EDGE_FUNCTION_URL,
        method: 'POST',
        headers: {
          hasContentType: !!headers['Content-Type'],
          hasAuthorization: !!headers['Authorization'],
          authHeaderLength: headers['Authorization'].length,
          authHeaderPreview: headers['Authorization'].substring(0, 30) + '...',
          hasApiKey: !!headers['apikey'],
          hasDebugSource: !!headers['x-debug-source'],
          hasUserAgent: !!headers['x-user-agent']
        },
        payloadAction: payload.action,
        payloadUserId: payload.user_id,
        payloadFlowName: payload.userConfig.flowName,
        bodySize: JSON.stringify(payload).length,
        timestamp: new Date().toISOString()
      });

      console.log('[FLOW EXECUTION] 🌐 Making fetch request...');
      const fetchStartTime = Date.now();

      let response: Response;
      try {
        response = await fetch(this.EDGE_FUNCTION_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        
        const fetchDuration = Date.now() - fetchStartTime;
        console.log('[FLOW EXECUTION] 📥 Fetch completed:', {
          fetchDuration: `${fetchDuration}ms`,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          url: response.url,
          type: response.type,
          redirected: response.redirected,
          timestamp: new Date().toISOString()
        });

      } catch (fetchError) {
        const fetchDuration = Date.now() - fetchStartTime;
        console.error('[FLOW EXECUTION] 💥 FETCH ERROR - Request failed before reaching edge function:', {
          fetchDuration: `${fetchDuration}ms`,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          errorType: fetchError instanceof Error ? fetchError.constructor.name : typeof fetchError,
          stack: fetchError instanceof Error ? fetchError.stack : 'No stack trace',
          url: this.EDGE_FUNCTION_URL,
          authHeaderPresent: !!headers['Authorization'],
          timestamp: new Date().toISOString()
        });
        throw new Error(`Network request failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      }

      console.log('[FLOW EXECUTION] 📋 Response headers received:', {
        responseHeaders: Object.fromEntries(response.headers.entries()),
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        cors: {
          allowOrigin: response.headers.get('access-control-allow-origin'),
          allowHeaders: response.headers.get('access-control-allow-headers'),
          allowMethods: response.headers.get('access-control-allow-methods')
        },
        timestamp: new Date().toISOString()
      });

      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
          console.error('[FLOW EXECUTION] ❌ Error response received:', {
            status: response.status,
            statusText: response.statusText,
            errorText,
            errorLength: errorText.length,
            isAuthError: response.status === 401,
            is403Error: response.status === 403,
            is500Error: response.status === 500,
            headers: Object.fromEntries(response.headers.entries()),
            timestamp: new Date().toISOString()
          });
        } catch (textError) {
          console.error('[FLOW EXECUTION] ❌ Could not read error response body:', {
            textError: textError instanceof Error ? textError.message : String(textError),
            originalStatus: response.status,
            timestamp: new Date().toISOString()
          });
          errorText = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        if (response.status === 401) {
          console.error('[FLOW EXECUTION] 🔐 401 UNAUTHORIZED - DETAILED ANALYSIS:', {
            status: response.status,
            statusText: response.statusText,
            errorText,
            sentHeaders: headers,
            sessionInfo: {
              hasSession: !!session,
              userId: session?.user?.id,
              userEmail: session?.user?.email,
              accessToken: session?.access_token ? 'Present' : 'Missing',
              tokenExpiry: session?.expires_at
            },
            possibleCauses: [
              'Session expired',
              'Invalid access token',
              'Edge function not receiving auth headers',
              'RLS policy blocking request'
            ],
            timestamp: new Date().toISOString()
          });
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
        console.log('[FLOW EXECUTION] 📊 Response parsed successfully:', {
          hasResult: !!result,
          resultSuccess: result?.success,
          hasError: !!result?.error,
          authMethod: result?.auth_method,
          userEmail: result?.user_email,
          requestId: result?.request_id,
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
      
      console.error('[FLOW EXECUTION] 💥 Flow execution failed with full analysis:', {
        error: errorMsg,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        flowId,
        userId: userConfig.userId,
        duration: `${duration}ms`,
        authRelated: errorMsg.includes('authorization') || errorMsg.includes('401') || errorMsg.includes('auth'),
        networkRelated: errorMsg.includes('Network') || errorMsg.includes('fetch'),
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
