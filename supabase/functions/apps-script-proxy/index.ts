import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders, createCorsResponse, handleCorsPrelight } from "../_shared/cors.ts"
import { extractDebugInfo, logNetworkEvent } from "../_shared/network-utils.ts"
import { RequestBody } from "./types.ts"
import { getUserEmail } from "./user-service.ts"
import { callAppsScript } from "./apps-script-client.ts"
import { buildAppsScriptPayload } from "./payload-builder.ts"
import { processAppsScriptResponse } from "./response-processor.ts"

serve(async (req) => {
  const debugInfo = extractDebugInfo(req);
  const startTime = Date.now();
  logNetworkEvent('REQUEST_RECEIVED', debugInfo);

  console.log('[EDGE FUNCTION] 🚀 Edge Function started with two-layer format support:', {
    method: req.method,
    url: req.url,
    debugInfo,
    targetFormat: 'two-layer-secret-payload',
    timestamp: new Date().toISOString()
  });

  // Log all request headers for auth debugging
  const headers = Object.fromEntries(req.headers.entries());
  console.log('[EDGE FUNCTION] 🔐 Request headers analysis for two-layer auth:', {
    hasAuthorization: !!headers.authorization,
    hasApikey: !!headers.apikey,
    hasClientInfo: !!headers['x-client-info'],
    allHeaders: headers,
    authHeaderValue: headers.authorization ? 'Bearer token present' : 'No Authorization header',
    request_id: debugInfo.request_id,
    timestamp: new Date().toISOString()
  });

  if (req.method === 'OPTIONS') {
    logNetworkEvent('CORS_PREFLIGHT', { request_id: debugInfo.request_id });
    console.log('[EDGE FUNCTION] 🔄 Handling CORS preflight request');
    return handleCorsPrelight();
  }

  try {
    logNetworkEvent('FUNCTION_START', { request_id: debugInfo.request_id });

    // Enhanced auth header check for two-layer format
    const authHeader = req.headers.get('authorization');
    const apiKeyHeader = req.headers.get('apikey');
    
    console.log('[EDGE FUNCTION] 🔐 Two-layer auth context analysis:', {
      hasAuthHeader: !!authHeader,
      authHeaderType: authHeader ? authHeader.substring(0, 20) + '...' : 'None',
      hasApiKey: !!apiKeyHeader,
      apiKeyPresent: apiKeyHeader ? 'Present' : 'None',
      userAgent: req.headers.get('user-agent'),
      note: 'Two-layer format uses secret in payload, not headers',
      request_id: debugInfo.request_id,
      timestamp: new Date().toISOString()
    });

    if (!authHeader && !apiKeyHeader) {
      console.error('[EDGE FUNCTION] 🔐 MISSING AUTHORIZATION ERROR (Two-layer format):', {
        error: 'No authorization header or API key found',
        availableHeaders: Object.keys(headers),
        expectedHeaders: ['authorization', 'apikey'],
        note: 'Two-layer format still requires Supabase auth for user lookup',
        request_id: debugInfo.request_id,
        timestamp: new Date().toISOString()
      });
      
      return createCorsResponse({
        error: 'Missing authorization header',
        details: 'Request must include authorization header with Bearer token or apikey header',
        debug_info: {
          available_headers: Object.keys(headers),
          expected_auth: 'Bearer token in Authorization header',
          note: 'Required for user lookup even with two-layer Apps Script auth',
          request_id: debugInfo.request_id
        }
      }, 401);
    }

    console.log('[EDGE FUNCTION] ✅ Authorization headers found for two-layer format:', {
      authMethod: authHeader ? 'Bearer token' : 'API key',
      note: 'This auth is for Supabase user lookup, Apps Script uses secret in payload',
      request_id: debugInfo.request_id,
      timestamp: new Date().toISOString()
    });

    // Get environment variables with validation
    const appsScriptUrl = Deno.env.get('APPS_SCRIPT_URL')
    const appsScriptSecret = Deno.env.get('APPS_SCRIPT_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    console.log('[EDGE FUNCTION] 🔧 Environment variables check for two-layer format:', {
      hasAppsScriptUrl: !!appsScriptUrl,
      hasAppsScriptSecret: !!appsScriptSecret,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceKey: !!supabaseServiceKey,
      appsScriptUrlLength: appsScriptUrl?.length || 0,
      secretLength: appsScriptSecret?.length || 0,
      note: 'Apps Script secret will be used in two-layer payload',
      request_id: debugInfo.request_id,
      timestamp: new Date().toISOString()
    });

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

      console.log('[EDGE FUNCTION] 📖 Request body received for two-layer transformation:', {
        bodyLength: bodyText.length,
        bodyPreview: bodyText.substring(0, 500),
        isEmpty: bodyText.trim().length === 0,
        targetFormat: 'two-layer-secret-payload',
        request_id: debugInfo.request_id,
        timestamp: new Date().toISOString()
      });

      if (!bodyText || bodyText.trim().length === 0) {
        return createCorsResponse({
          error: 'Empty request body received',
          request_id: debugInfo.request_id
        }, 400);
      }

      originalPayload = JSON.parse(bodyText);
      
      console.log('[EDGE FUNCTION] 📋 Parsed request payload for two-layer format:', {
        parsedPayload: JSON.stringify(originalPayload, null, 2),
        hasAction: !!originalPayload.action,
        action: originalPayload.action,
        hasUserId: !!originalPayload.user_id,
        hasUserConfig: !!originalPayload.userConfig,
        willBecomePayloadLayer: 'This will become the inner payload in two-layer structure',
        request_id: debugInfo.request_id,
        timestamp: new Date().toISOString()
      });

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
      console.error('[EDGE FUNCTION] 💥 Payload parsing error:', {
        error: error.message,
        request_id: debugInfo.request_id,
        timestamp: new Date().toISOString()
      });
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
      console.log('[EDGE FUNCTION] 📧 Fetching user email for two-layer format:', {
        user_id: originalPayload.user_id,
        hasAuthHeader: !!authHeader,
        supabaseAuth: 'Using service role key for profile lookup',
        note: 'User email will be included in two-layer payload',
        request_id: debugInfo.request_id,
        timestamp: new Date().toISOString()
      });

      userEmail = await getUserEmail(
        originalPayload.user_id,
        supabaseUrl,
        supabaseServiceKey,
        debugInfo.request_id
      );

      if (!userEmail) {
        console.error('[EDGE FUNCTION] 📧 User email lookup failed:', {
          user_id: originalPayload.user_id,
          authPresent: !!authHeader,
          request_id: debugInfo.request_id,
          timestamp: new Date().toISOString()
        });
        
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

      console.log('[EDGE FUNCTION] ✅ User email retrieved for two-layer payload:', {
        user_id: originalPayload.user_id,
        hasEmail: !!userEmail,
        authMethod: 'service-role-lookup',
        willBeInPayloadLayer: true,
        request_id: debugInfo.request_id,
        timestamp: new Date().toISOString()
      });
    }

    // Create two-layer payload for Apps Script
    console.log('[EDGE FUNCTION] 🔧 Building two-layer Apps Script payload...');
    const twoLayerPayload = buildAppsScriptPayload(
      originalPayload,
      userEmail,
      appsScriptSecret,
      debugInfo.request_id
    );

    console.log('[EDGE FUNCTION] 🚀 Calling Apps Script with two-layer format:', {
      userEmail: userEmail,
      flowName: twoLayerPayload.payload?.userConfig?.flowName,
      driveFolder: twoLayerPayload.payload?.userConfig?.driveFolder,
      authMethod: 'two-layer-secret-payload',
      hasSecret: !!twoLayerPayload.secret,
      hasPayload: !!twoLayerPayload.payload,
      innerAction: twoLayerPayload.payload?.action,
      request_id: debugInfo.request_id,
      timestamp: new Date().toISOString()
    });

    logNetworkEvent('CALLING_APPS_SCRIPT', {
      userEmail: userEmail,
      flowName: twoLayerPayload.payload?.userConfig?.flowName,
      driveFolder: twoLayerPayload.payload?.userConfig?.driveFolder,
      format: 'two-layer-secret-payload',
      request_id: debugInfo.request_id
    });

    // Call Apps Script with two-layer format
    try {
      const appsScriptData = await callAppsScript(
        appsScriptUrl,
        twoLayerPayload,
        debugInfo.request_id
      );

      const totalDuration = Date.now() - startTime;

      console.log('[EDGE FUNCTION] ✅ Apps Script call successful with two-layer format:', {
        status: appsScriptData.status,
        attachments: appsScriptData.data?.attachments || 0,
        total_duration: totalDuration,
        authMethod: appsScriptData.data?.authMethod || 'unknown',
        version: appsScriptData.version,
        processingTime: appsScriptData.processing_time,
        request_id: debugInfo.request_id,
        timestamp: new Date().toISOString()
      });

      logNetworkEvent('SUCCESS', {
        status: appsScriptData.status,
        attachments: appsScriptData.data?.attachments || 0,
        total_duration: totalDuration,
        format: 'two-layer-secret-payload',
        request_id: debugInfo.request_id
      });

      // Process the response using the two-layer format response processor
      const processedResponse = processAppsScriptResponse(
        appsScriptData,
        userEmail,
        debugInfo.request_id,
        totalDuration
      );

      console.log('[EDGE FUNCTION] 📤 Returning processed two-layer response:', {
        responseType: processedResponse.success ? 'success' : 'error',
        hasAppsScriptResponse: !!processedResponse.apps_script_response,
        authMethod: processedResponse.auth_method,
        version: processedResponse.apps_script_response?.version,
        request_id: debugInfo.request_id,
        timestamp: new Date().toISOString()
      });

      return createCorsResponse(processedResponse, 200);

    } catch (appsScriptError) {
      const totalDuration = Date.now() - startTime;
      
      console.error('[EDGE FUNCTION] ❌ Apps Script call failed with two-layer format:', {
        error: appsScriptError.message,
        request_id: debugInfo.request_id,
        total_duration: totalDuration,
        authMethod: 'two-layer-secret-payload',
        sentPayloadStructure: {
          hasSecret: !!twoLayerPayload.secret,
          hasPayload: !!twoLayerPayload.payload,
          innerAction: twoLayerPayload.payload?.action
        },
        timestamp: new Date().toISOString()
      });
      
      logNetworkEvent('APPS_SCRIPT_ERROR', {
        error: appsScriptError.message,
        request_id: debugInfo.request_id,
        total_duration: totalDuration,
        format: 'two-layer-secret-payload'
      });
      
      return createCorsResponse({
        error: 'Apps Script execution failed',
        details: appsScriptError.message,
        request_id: debugInfo.request_id,
        total_duration: totalDuration,
        debug_info: {
          user_id: originalPayload.user_id,
          user_email: userEmail,
          apps_script_url: appsScriptUrl,
          auth_method: 'two-layer-secret-payload',
          sent_payload_structure: {
            hasSecret: !!twoLayerPayload.secret,
            hasPayload: !!twoLayerPayload.payload
          }
        }
      }, 502);
    }

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    
    console.error('[EDGE FUNCTION] 💥 Edge Function internal error:', {
      error: error.message,
      request_id: debugInfo.request_id,
      total_duration: totalDuration,
      authRelated: error.message.includes('authorization') || error.message.includes('auth'),
      timestamp: new Date().toISOString()
    });
    
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
