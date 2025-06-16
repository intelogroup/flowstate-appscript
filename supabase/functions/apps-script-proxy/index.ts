
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders, createCorsResponse, handleCorsPrelight } from "../_shared/cors.ts"
import { extractDebugInfo, logNetworkEvent, generateRequestId, createRetryableError } from "../_shared/network-utils.ts"

interface FlowConfig {
  emailFilter: string
  driveFolder: string
  fileTypes?: string[]
  userId?: string
  flowName?: string
}

interface RequestBody {
  action: string
  flowId?: string
  access_token?: string
  userConfig?: FlowConfig
  googleTokens?: any
  debug_info?: any
}

serve(async (req) => {
  const debugInfo = extractDebugInfo(req);
  logNetworkEvent('REQUEST_RECEIVED', debugInfo);

  // Enhanced CORS preflight handling
  if (req.method === 'OPTIONS') {
    logNetworkEvent('CORS_PREFLIGHT', { request_id: debugInfo.request_id });
    return handleCorsPrelight();
  }

  try {
    logNetworkEvent('FUNCTION_START', { request_id: debugInfo.request_id });

    // Get environment variables with enhanced error reporting
    const appsScriptUrl = Deno.env.get('APPS_SCRIPT_URL')
    const appsScriptSecret = Deno.env.get('APPS_SCRIPT_SECRET')

    if (!appsScriptUrl) {
      logNetworkEvent('CONFIG_ERROR', { 
        error: 'APPS_SCRIPT_URL missing', 
        request_id: debugInfo.request_id 
      });
      return createCorsResponse({
        error: 'Configuration error: APPS_SCRIPT_URL not set',
        request_id: debugInfo.request_id,
        troubleshooting: {
          message: 'Environment variable missing',
          steps: [
            '1. Set APPS_SCRIPT_URL in your Supabase Edge Function secrets',
            '2. Use your Apps Script web app deployment URL',
            '3. Format: https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
          ]
        }
      }, 500);
    }

    if (!appsScriptSecret) {
      logNetworkEvent('CONFIG_ERROR', { 
        error: 'APPS_SCRIPT_SECRET missing', 
        request_id: debugInfo.request_id 
      });
      return createCorsResponse({
        error: 'Configuration error: APPS_SCRIPT_SECRET not set',
        request_id: debugInfo.request_id,
        troubleshooting: {
          message: 'Secret token missing',
          steps: [
            '1. Generate a secret using Apps Script PropertiesService',
            '2. Store it as APPS_SCRIPT_SECRET in Supabase Edge Function secrets',
            '3. Use the same secret in your Apps Script code for validation'
          ]
        }
      }, 500);
    }

    // Enhanced request body parsing with size validation
    let originalPayload: RequestBody
    try {
      const bodyText = await req.text();
      logNetworkEvent('BODY_RECEIVED', { 
        size: bodyText.length, 
        preview: bodyText.substring(0, 100),
        request_id: debugInfo.request_id 
      });

      if (bodyText.length > 1024 * 1024) { // 1MB limit
        throw createRetryableError('Request payload too large (>1MB)', false);
      }

      originalPayload = JSON.parse(bodyText);
      logNetworkEvent('PAYLOAD_PARSED', {
        action: originalPayload.action,
        flowId: originalPayload.flowId,
        hasAccessToken: !!originalPayload.access_token,
        hasUserConfig: !!originalPayload.userConfig,
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

    // Validate required fields
    if (!originalPayload.action) {
      return createCorsResponse({
        error: 'Missing required field: action',
        received: Object.keys(originalPayload),
        request_id: debugInfo.request_id
      }, 400);
    }

    // Create enhanced body for Google Apps Script
    const bodyForGas = {
      secret: appsScriptSecret,
      payload: originalPayload,
      debug_info: {
        ...debugInfo,
        supabase_timestamp: new Date().toISOString(),
        auth_method: 'body-based-v2'
      }
    }

    logNetworkEvent('CALLING_APPS_SCRIPT', {
      url: appsScriptUrl,
      action: originalPayload.action,
      flowId: originalPayload.flowId,
      request_id: debugInfo.request_id,
      payload_size: JSON.stringify(bodyForGas).length
    });

    // Enhanced fetch with timeout and retry logic
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let response;
    try {
      response = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Supabase-Edge-Function/2.0',
          'X-Request-ID': debugInfo.request_id
        },
        body: JSON.stringify(bodyForGas),
        redirect: 'follow',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      logNetworkEvent('FETCH_ERROR', { 
        error: fetchError.message,
        name: fetchError.name,
        request_id: debugInfo.request_id
      });
      
      if (fetchError.name === 'AbortError') {
        return createCorsResponse({
          error: 'Apps Script request timeout (30s)',
          request_id: debugInfo.request_id,
          troubleshooting: {
            message: 'The request to Google Apps Script timed out',
            steps: [
              '1. Check if your Apps Script deployment is responding',
              '2. Verify the APPS_SCRIPT_URL is correct',
              '3. Try again in a few minutes'
            ]
          }
        }, 504);
      }
      
      throw fetchError;
    }

    logNetworkEvent('APPS_SCRIPT_RESPONSE', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      request_id: debugInfo.request_id
    });

    if (!response.ok) {
      const responseText = await response.text();
      logNetworkEvent('APPS_SCRIPT_ERROR', {
        status: response.status,
        statusText: response.statusText,
        body: responseText.substring(0, 500),
        request_id: debugInfo.request_id
      });

      const isHtmlResponse = responseText.trim().startsWith('<!DOCTYPE') || 
                           responseText.trim().startsWith('<html')

      return createCorsResponse({
        error: `Apps Script error (${response.status}): ${
          isHtmlResponse 
            ? 'Apps Script deployment access issue - check deployment settings' 
            : response.statusText || 'Unknown error'
        }`,
        request_id: debugInfo.request_id,
        apps_script_status: response.status,
        troubleshooting: {
          message: isHtmlResponse 
            ? 'Apps Script deployment needs proper access settings'
            : 'Apps Script returned an error',
          steps: isHtmlResponse ? [
            '1. Go to your Apps Script project',
            '2. Click Deploy → Manage deployments', 
            '3. Click the gear icon to edit deployment settings',
            '4. Set "Execute as" to "Me" (your account)',
            '5. Set "Who has access" to "Anyone"',
            '6. Click Deploy and test the new URL'
          ] : [
            '1. Check Apps Script logs for detailed error information',
            '2. Verify the secret token matches between Supabase and Apps Script',
            '3. Ensure your Apps Script doPost function handles body-based auth'
          ]
        },
        apps_script_url: appsScriptUrl,
        error_details: responseText.substring(0, 200),
        auth_method: 'body-based-v2'
      }, 502);
    }

    // Parse Apps Script response with enhanced error handling
    let appsScriptData
    try {
      const responseText = await response.text();
      appsScriptData = JSON.parse(responseText);
      
      logNetworkEvent('SUCCESS', {
        status: appsScriptData.status,
        message: appsScriptData.message,
        dataKeys: Object.keys(appsScriptData.data || {}),
        request_id: debugInfo.request_id
      });
    } catch (error) {
      logNetworkEvent('RESPONSE_PARSE_ERROR', { 
        error: error.message, 
        request_id: debugInfo.request_id 
      });
      return createCorsResponse({
        error: 'Apps Script returned invalid JSON',
        details: error.message,
        request_id: debugInfo.request_id
      }, 502);
    }

    // Return successful response with enhanced metadata
    return createCorsResponse({
      success: true,
      message: 'Flow processed successfully',
      timestamp: new Date().toISOString(),
      request_id: debugInfo.request_id,
      auth_method: 'body-based-v2',
      debug_info: debugInfo,
      apps_script_response: appsScriptData
    }, 200);

  } catch (error) {
    logNetworkEvent('EDGE_FUNCTION_ERROR', { 
      error: error.message,
      name: error.constructor.name,
      stack: error.stack?.substring(0, 500),
      request_id: debugInfo.request_id
    });
    
    return createCorsResponse({
      error: 'Edge Function internal error',
      message: error.message,
      timestamp: new Date().toISOString(),
      request_id: debugInfo.request_id,
      retryable: (error as any).retryable !== false
    }, 500);
  }
})
