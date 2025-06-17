
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders, createCorsResponse, handleCorsPrelight } from "../_shared/cors.ts"
import { extractDebugInfo, logNetworkEvent } from "../_shared/network-utils.ts"
import { RequestBody } from "./types.ts"
import { getUserEmail } from "./user-service.ts"
import { callAppsScript } from "./apps-script-client.ts"
import { buildAppsScriptPayload } from "./payload-builder.ts"

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
      userEmail = await getUserEmail(
        originalPayload.user_id,
        supabaseUrl,
        supabaseServiceKey,
        debugInfo.request_id
      );
    }

    // Create payload for Apps Script using shared secret authentication
    const appsScriptPayload = buildAppsScriptPayload(
      originalPayload,
      userEmail,
      appsScriptSecret,
      debugInfo.request_id
    );

    // Call Apps Script
    try {
      const appsScriptData = await callAppsScript(
        appsScriptUrl,
        appsScriptPayload,
        debugInfo.request_id
      );

      const totalDuration = Date.now() - startTime;

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

    } catch (appsScriptError) {
      const totalDuration = Date.now() - startTime;
      return createCorsResponse({
        error: appsScriptError.message,
        request_id: debugInfo.request_id,
        total_duration: totalDuration
      }, 502);
    }

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
