
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
}

serve(async (req) => {
  const debugInfo = extractDebugInfo(req);
  const startTime = Date.now();
  logNetworkEvent('REQUEST_RECEIVED', debugInfo);

  // Enhanced CORS preflight handling
  if (req.method === 'OPTIONS') {
    logNetworkEvent('CORS_PREFLIGHT', { request_id: debugInfo.request_id });
    return handleCorsPrelight();
  }

  try {
    logNetworkEvent('FUNCTION_START', { request_id: debugInfo.request_id });

    // Get environment variables
    const appsScriptUrl = Deno.env.get('APPS_SCRIPT_URL')
    const appsScriptSecret = Deno.env.get('APPS_SCRIPT_SECRET')

    if (!appsScriptUrl) {
      return createCorsResponse({
        error: 'Configuration error: APPS_SCRIPT_URL not set',
        request_id: debugInfo.request_id
      }, 500);
    }

    if (!appsScriptSecret) {
      return createCorsResponse({
        error: 'Configuration error: APPS_SCRIPT_SECRET not set',
        request_id: debugInfo.request_id
      }, 500);
    }

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

    // SIMPLIFIED DEV MODE: Create minimal payload structure
    const bodyForGas = {
      secret: appsScriptSecret,
      payload: {
        action: 'process_gmail_flow',
        userConfig: {
          senders: originalPayload.userConfig?.senders || 'jayveedz19@gmail.com',
          driveFolder: originalPayload.userConfig?.driveFolder || 'Email Attachments',
          fileTypes: originalPayload.userConfig?.fileTypes || ['pdf'],
          flowName: originalPayload.userConfig?.flowName || 'Default Flow',
          maxEmails: 10,
          enableDebugMode: true,
          devMode: true // Signal to Apps Script that this is dev mode
        },
        // SIMPLIFIED: Don't pass any auth tokens - let Apps Script handle dev mode
        debug_info: {
          request_id: debugInfo.request_id,
          dev_mode: true,
          timestamp: new Date().toISOString()
        }
      }
    };

    logNetworkEvent('CALLING_APPS_SCRIPT_DEV_MODE', {
      url: appsScriptUrl,
      senders: bodyForGas.payload.userConfig.senders,
      driveFolder: bodyForGas.payload.userConfig.driveFolder,
      request_id: debugInfo.request_id,
      devMode: true
    });

    // Make simplified request to Apps Script
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    let response;
    try {
      response = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': debugInfo.request_id,
          'X-Dev-Mode': 'true'
        },
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
        dev_mode: true
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
        dev_mode: true
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
      message: 'Flow processed successfully (dev mode)',
      request_id: debugInfo.request_id,
      dev_mode: true,
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
      total_duration: totalDuration,
      dev_mode: true
    }, 500);
  }
})
