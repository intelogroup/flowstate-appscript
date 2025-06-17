
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

    // Get environment variables with validation
    const appsScriptUrl = Deno.env.get('APPS_SCRIPT_URL')
    const appsScriptSecret = Deno.env.get('APPS_SCRIPT_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Enhanced environment validation
    if (!appsScriptUrl || !appsScriptSecret) {
      logNetworkEvent('CONFIG_ERROR', {
        hasUrl: !!appsScriptUrl,
        hasSecret: !!appsScriptSecret,
        request_id: debugInfo.request_id
      });
      return createCorsResponse({
        error: 'Configuration error: Missing Apps Script configuration',
        details: `Missing ${!appsScriptUrl ? 'APPS_SCRIPT_URL' : ''} ${!appsScriptSecret ? 'APPS_SCRIPT_SECRET' : ''}`.trim(),
        request_id: debugInfo.request_id
      }, 500);
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      logNetworkEvent('CONFIG_ERROR', {
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseKey: !!supabaseServiceKey,
        request_id: debugInfo.request_id
      });
      return createCorsResponse({
        error: 'Configuration error: Missing Supabase configuration',
        details: `Missing ${!supabaseUrl ? 'SUPABASE_URL' : ''} ${!supabaseServiceKey ? 'SUPABASE_SERVICE_ROLE_KEY' : ''}`.trim(),
        request_id: debugInfo.request_id
      }, 500);
    }

    // Parse and validate request body
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
      
      // Enhanced payload validation
      if (!originalPayload.action) {
        return createCorsResponse({
          error: 'Missing required field: action',
          request_id: debugInfo.request_id
        }, 400);
      }

      if (!originalPayload.user_id) {
        return createCorsResponse({
          error: 'Missing required field: user_id',
          request_id: debugInfo.request_id
        }, 400);
      }

      logNetworkEvent('PAYLOAD_PARSED', {
        action: originalPayload.action,
        flowName: originalPayload.userConfig?.flowName,
        userId: originalPayload.user_id,
        hasDriveFolder: !!originalPayload.userConfig?.driveFolder,
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

      if (!userEmail) {
        logNetworkEvent('USER_EMAIL_NOT_FOUND', {
          user_id: originalPayload.user_id,
          request_id: debugInfo.request_id
        });
        return createCorsResponse({
          error: 'User email not found in profiles table',
          details: 'User must have a profile with email to execute flows',
          request_id: debugInfo.request_id
        }, 400);
      }
    }

    // Create payload for Apps Script using shared secret authentication
    const appsScriptPayload = buildAppsScriptPayload(
      originalPayload,
      userEmail,
      appsScriptSecret,
      debugInfo.request_id
    );

    logNetworkEvent('CALLING_APPS_SCRIPT', {
      userEmail: userEmail,
      flowName: appsScriptPayload.userConfig.flowName,
      driveFolder: appsScriptPayload.userConfig.driveFolder,
      request_id: debugInfo.request_id
    });

    // Call Apps Script with enhanced error handling
    try {
      const appsScriptData = await callAppsScript(
        appsScriptUrl,
        appsScriptPayload,
        debugInfo.request_id
      );

      const totalDuration = Date.now() - startTime;

      logNetworkEvent('SUCCESS', {
        status: appsScriptData.status,
        attachments: appsScriptData.data?.attachments || 0,
        total_duration: totalDuration,
        request_id: debugInfo.request_id
      });

      // Return successful response with enhanced debugging
      return createCorsResponse({
        success: true,
        message: `Flow processed successfully using shared secret authentication`,
        request_id: debugInfo.request_id,
        auth_method: 'shared-secret',
        user_email: userEmail,
        performance_metrics: {
          total_duration: totalDuration
        },
        apps_script_response: appsScriptData,
        debug_info: {
          user_id: originalPayload.user_id,
          user_email: userEmail,
          flow_name: originalPayload.userConfig?.flowName,
          drive_folder: originalPayload.userConfig?.driveFolder
        }
      }, 200);

    } catch (appsScriptError) {
      const totalDuration = Date.now() - startTime;
      logNetworkEvent('APPS_SCRIPT_ERROR', {
        error: appsScriptError.message,
        request_id: debugInfo.request_id,
        total_duration: totalDuration
      });
      
      return createCorsResponse({
        error: 'Apps Script execution failed',
        details: appsScriptError.message,
        request_id: debugInfo.request_id,
        total_duration: totalDuration,
        debug_info: {
          user_id: originalPayload.user_id,
          user_email: userEmail,
          apps_script_url: appsScriptUrl
        }
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
