
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders, createCorsResponse, handleCorsPrelight } from "../_shared/cors.ts"
import { extractDebugInfo, logNetworkEvent, generateRequestId } from "../_shared/network-utils.ts"

interface FlowConfig {
  senders?: string
  emailFilter?: string
  driveFolder: string
  fileTypes?: string[]
  userId?: string
  flowName?: string
  maxEmails?: number
  enableDebugMode?: boolean
}

interface RequestBody {
  action: string
  flowId?: string
  userConfig?: FlowConfig
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

    // Get user email from Supabase profiles table
    let userEmail = null;
    if (originalPayload.user_id) {
      try {
        logNetworkEvent('FETCHING_USER_EMAIL', {
          user_id: originalPayload.user_id,
          request_id: debugInfo.request_id
        });

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', originalPayload.user_id)
          .single();

        if (profileError) {
          logNetworkEvent('USER_EMAIL_FETCH_ERROR', {
            error: profileError.message,
            user_id: originalPayload.user_id,
            request_id: debugInfo.request_id
          });
        } else if (profile?.email) {
          userEmail = profile.email;
          logNetworkEvent('USER_EMAIL_RETRIEVED', {
            user_id: originalPayload.user_id,
            request_id: debugInfo.request_id
          });
        }
      } catch (error) {
        logNetworkEvent('USER_EMAIL_RETRIEVAL_ERROR', {
          error: error.message,
          user_id: originalPayload.user_id,
          request_id: debugInfo.request_id
        });
      }
    }

    // Create payload for Apps Script using shared secret authentication
    const bodyForGas = {
      auth_token: appsScriptSecret, // Simple shared secret authentication
      action: 'process_gmail_flow',
      userEmail: userEmail, // Pass user's email for personalized processing
      userConfig: {
        senders: originalPayload.userConfig?.senders || originalPayload.userConfig?.emailFilter,
        driveFolder: originalPayload.userConfig?.driveFolder || 'Email Attachments',
        fileTypes: originalPayload.userConfig?.fileTypes || ['pdf'],
        flowName: originalPayload.userConfig?.flowName || 'Default Flow',
        maxEmails: 10,
        enableDebugMode: true
      },
      debug_info: {
        request_id: debugInfo.request_id,
        has_user_email: !!userEmail,
        auth_method: 'shared-secret',
        timestamp: new Date().toISOString()
      }
    };

    logNetworkEvent('CALLING_APPS_SCRIPT', {
      url: appsScriptUrl,
      userEmail: userEmail,
      senders: bodyForGas.userConfig.senders,
      driveFolder: bodyForGas.userConfig.driveFolder,
      authMethod: 'shared-secret',
      request_id: debugInfo.request_id
    });

    // Make request to Apps Script
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let response;
    try {
      response = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': debugInfo.request_id
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
        total_duration: totalDuration
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
        total_duration: totalDuration
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
      message: `Flow processed successfully using shared secret authentication`,
      request_id: debugInfo.request_id,
      auth_method: 'shared-secret',
      user_email: userEmail,
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
