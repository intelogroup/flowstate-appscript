
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders, createCorsResponse, handleCorsPrelight } from "../_shared/cors.ts"
import { extractDebugInfo, logNetworkEvent, generateRequestId, createRetryableError } from "../_shared/network-utils.ts"

interface FlowConfig {
  senders?: string
  emailFilter?: string
  driveFolder: string
  fileTypes?: string[]
  userId?: string
  flowName?: string
  maxEmails?: number
  enableDebugMode?: boolean
  showEmailDetails?: boolean
}

interface RequestBody {
  action: string
  flowId?: string
  access_token?: string
  auth_token?: string
  userConfig?: FlowConfig
  googleTokens?: any
  debug_info?: any
  user_id?: string
}

serve(async (req) => {
  const debugInfo = extractDebugInfo(req);
  const startTime = Date.now();
  logNetworkEvent('REQUEST_RECEIVED', debugInfo);

  if (req.method === 'OPTIONS') {
    logNetworkEvent('CORS_PREFLIGHT', { request_id: debugInfo.request_id });
    return handleCorsPrelight();
  }

  try {
    logNetworkEvent('FUNCTION_START', { request_id: debugInfo.request_id });

    // Get environment variables
    const appsScriptUrl = Deno.env.get('APPS_SCRIPT_URL')
    const appsScriptSecret = Deno.env.get('APPS_SCRIPT_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!appsScriptUrl || !appsScriptSecret) {
      return createCorsResponse({
        error: 'Configuration error: Missing Apps Script configuration',
        request_id: debugInfo.request_id
      }, 500);
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return createCorsResponse({
        error: 'Configuration error: Missing Supabase configuration',
        request_id: debugInfo.request_id
      }, 500);
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let originalPayload: RequestBody;
    try {
      const bodyText = await req.text();
      logNetworkEvent('BODY_RECEIVED', { 
        size: bodyText.length, 
        request_id: debugInfo.request_id 
      });

      if (!bodyText || bodyText.trim().length === 0) {
        return createCorsResponse({
          error: 'Empty request body received',
          request_id: debugInfo.request_id
        }, 400);
      }

      originalPayload = JSON.parse(bodyText);
      logNetworkEvent('PAYLOAD_PARSED', {
        action: originalPayload.action,
        flowName: originalPayload.userConfig?.flowName,
        userId: originalPayload.user_id,
        request_id: debugInfo.request_id
      });
    } catch (error) {
      logNetworkEvent('PARSE_ERROR', { 
        error: error.message, 
        request_id: debugInfo.request_id 
      });
      return createCorsResponse({
        error: 'Invalid JSON in request body',
        details: error.message,
        request_id: debugInfo.request_id
      }, 400);
    }

    // Try to get saved tokens from database if user_id is provided
    let authToken = originalPayload.auth_token || originalPayload.access_token;
    
    if (originalPayload.user_id && !authToken) {
      try {
        logNetworkEvent('FETCHING_SAVED_TOKENS', {
          user_id: originalPayload.user_id,
          request_id: debugInfo.request_id
        });

        const { data: savedTokens, error: tokenError } = await supabase
          .from('user_auth_tokens')
          .select('*')
          .eq('user_id', originalPayload.user_id)
          .eq('provider', 'google')
          .single();

        if (tokenError) {
          logNetworkEvent('TOKEN_FETCH_ERROR', {
            error: tokenError.message,
            user_id: originalPayload.user_id,
            request_id: debugInfo.request_id
          });
        } else if (savedTokens) {
          // Use provider_token first, then access_token as fallback
          authToken = savedTokens.provider_token || savedTokens.access_token;
          
          logNetworkEvent('SAVED_TOKENS_RETRIEVED', {
            user_id: originalPayload.user_id,
            hasProviderToken: !!savedTokens.provider_token,
            hasAccessToken: !!savedTokens.access_token,
            tokenType: savedTokens.provider_token ? 'provider_token' : 'access_token',
            request_id: debugInfo.request_id
          });
        } else {
          logNetworkEvent('NO_SAVED_TOKENS_FOUND', {
            user_id: originalPayload.user_id,
            request_id: debugInfo.request_id
          });
        }
      } catch (error) {
        logNetworkEvent('TOKEN_RETRIEVAL_ERROR', {
          error: error.message,
          user_id: originalPayload.user_id,
          request_id: debugInfo.request_id
        });
      }
    }

    // Create payload for Apps Script
    const bodyForGas = {
      secret: appsScriptSecret,
      payload: {
        action: 'process_gmail_flow',
        userConfig: {
          senders: originalPayload.userConfig?.senders || originalPayload.userConfig?.emailFilter || 'jayveedz19@gmail.com',
          driveFolder: originalPayload.userConfig?.driveFolder || 'Email Attachments',
          fileTypes: originalPayload.userConfig?.fileTypes || ['pdf'],
          flowName: originalPayload.userConfig?.flowName || 'Default Flow',
          maxEmails: 10,
          enableDebugMode: true,
          devMode: !authToken // Signal dev mode if no auth token
        },
        auth_token: authToken,
        access_token: authToken,
        googleTokens: authToken ? {
          access_token: authToken,
          provider_token: authToken
        } : undefined,
        debug_info: {
          request_id: debugInfo.request_id,
          has_auth_token: !!authToken,
          token_source: originalPayload.user_id ? 'saved_tokens' : 'request_payload',
          dev_mode: !authToken,
          timestamp: new Date().toISOString()
        }
      }
    };

    logNetworkEvent('CALLING_APPS_SCRIPT', {
      url: appsScriptUrl,
      senders: bodyForGas.payload.userConfig.senders,
      driveFolder: bodyForGas.payload.userConfig.driveFolder,
      hasAuthToken: !!authToken,
      tokenSource: originalPayload.user_id ? 'saved_tokens' : 'request_payload',
      devMode: !authToken,
      request_id: debugInfo.request_id
    });

    // Make request to Apps Script
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let response;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Request-ID': debugInfo.request_id
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        headers['X-Auth-Source'] = originalPayload.user_id ? 'saved-tokens' : 'request-payload';
      } else {
        headers['X-Dev-Mode'] = 'true';
      }

      response = await fetch(appsScriptUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyForGas),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      logNetworkEvent('FETCH_ERROR', { 
        error: fetchError.message,
        request_id: debugInfo.request_id
      });
      
      if (fetchError.name === 'AbortError') {
        return createCorsResponse({
          error: 'Apps Script request timeout (60s)',
          request_id: debugInfo.request_id
        }, 504);
      }
      
      throw fetchError;
    }

    const totalDuration = Date.now() - startTime;
    logNetworkEvent('APPS_SCRIPT_RESPONSE', {
      status: response.status,
      request_id: debugInfo.request_id,
      total_duration: totalDuration
    });

    if (!response.ok) {
      const responseText = await response.text();
      return createCorsResponse({
        error: `Apps Script error (${response.status})`,
        request_id: debugInfo.request_id,
        total_duration: totalDuration,
        has_auth_token: !!authToken
      }, 502);
    }

    // Parse Apps Script response
    let appsScriptData
    try {
      const responseText = await response.text();
      appsScriptData = JSON.parse(responseText);
      
      logNetworkEvent('SUCCESS', {
        status: appsScriptData.status,
        attachments: appsScriptData.data?.attachments || 0,
        request_id: debugInfo.request_id,
        total_duration: totalDuration,
        has_auth_token: !!authToken
      });
    } catch (error) {
      return createCorsResponse({
        error: 'Apps Script returned invalid JSON',
        details: error.message,
        request_id: debugInfo.request_id,
        total_duration: totalDuration
      }, 502);
    }

    // Return successful response
    return createCorsResponse({
      success: true,
      message: `Flow processed successfully ${authToken ? 'with auth tokens' : '(dev mode)'}`,
      request_id: debugInfo.request_id,
      has_auth_token: !!authToken,
      token_source: originalPayload.user_id ? 'saved_tokens' : 'request_payload',
      performance_metrics: {
        total_duration: totalDuration
      },
      apps_script_response: appsScriptData
    }, 200);

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    logNetworkEvent('EDGE_FUNCTION_ERROR', { 
      error: error.message,
      request_id: debugInfo.request_id,
      total_duration: totalDuration
    });
    
    return createCorsResponse({
      error: 'Edge Function internal error',
      message: error.message,
      request_id: debugInfo.request_id,
      total_duration: totalDuration
    }, 500);
  }
})
