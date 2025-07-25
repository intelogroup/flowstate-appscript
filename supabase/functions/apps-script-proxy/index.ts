
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

  console.log('[EDGE FUNCTION] 🚀 Edge Function started with V.07 format support:', {
    method: req.method,
    url: req.url,
    debugInfo,
    targetFormat: 'V.07-two-layer-secret-payload',
    timestamp: new Date().toISOString()
  });

  // Log all request headers for auth debugging
  const headers = Object.fromEntries(req.headers.entries());
  console.log('[EDGE FUNCTION] 🔐 Request headers analysis for V.07 auth:', {
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

    // Enhanced auth header check for V.07 format
    const authHeader = req.headers.get('authorization');
    const apiKeyHeader = req.headers.get('apikey');
    
    console.log('[EDGE FUNCTION] 🔐 V.07 auth context analysis:', {
      hasAuthHeader: !!authHeader,
      authHeaderType: authHeader ? authHeader.substring(0, 20) + '...' : 'None',
      hasApiKey: !!apiKeyHeader,
      apiKeyPresent: apiKeyHeader ? 'Present' : 'None',
      userAgent: req.headers.get('user-agent'),
      note: 'V.07 format uses secret in payload, not headers',
      request_id: debugInfo.request_id,
      timestamp: new Date().toISOString()
    });

    if (!authHeader && !apiKeyHeader) {
      console.error('[EDGE FUNCTION] 🔐 MISSING AUTHORIZATION ERROR (V.07 format):', {
        error: 'No authorization header or API key found',
        availableHeaders: Object.keys(headers),
        expectedHeaders: ['authorization', 'apikey'],
        note: 'V.07 format still requires Supabase auth for user lookup',
        request_id: debugInfo.request_id,
        timestamp: new Date().toISOString()
      });
      
      return createCorsResponse({
        error: 'Missing authorization header',
        details: 'Request must include authorization header with Bearer token or apikey header',
        debug_info: {
          available_headers: Object.keys(headers),
          expected_auth: 'Bearer token in Authorization header',
          note: 'Required for user lookup even with V.07 Apps Script auth',
          request_id: debugInfo.request_id
        }
      }, 401);
    }

    console.log('[EDGE FUNCTION] ✅ Authorization headers found for V.07 format:', {
      authMethod: authHeader ? 'Bearer token' : 'API key',
      note: 'This auth is for Supabase user lookup, Apps Script uses secret in payload',
      request_id: debugInfo.request_id,
      timestamp: new Date().toISOString()
    });

    // Get environment variables with validation - V.07 COMPATIBLE
    const appsScriptUrl = Deno.env.get('APPS_SCRIPT_URL')
    const scriptSecret = Deno.env.get('SCRIPT_SECRET')  // Using SCRIPT_SECRET to match V.07 Apps Script
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    console.log('[EDGE FUNCTION] 🔧 Environment variables check for V.07 compatibility:', {
      hasAppsScriptUrl: !!appsScriptUrl,
      hasScriptSecret: !!scriptSecret,  // V.07 compatible
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceKey: !!supabaseServiceKey,
      appsScriptUrlLength: appsScriptUrl?.length || 0,
      secretLength: scriptSecret?.length || 0,
      note: 'SCRIPT_SECRET matches V.07 Apps Script property name',
      request_id: debugInfo.request_id,
      timestamp: new Date().toISOString()
    });

    // Enhanced environment validation - V.07 COMPATIBLE
    if (!appsScriptUrl || !scriptSecret) {
      logNetworkEvent('CONFIG_ERROR', {
        hasUrl: !!appsScriptUrl,
        hasSecret: !!scriptSecret,
        request_id: debugInfo.request_id
      });
      return createCorsResponse({
        error: 'Configuration error: Missing Apps Script configuration',
        details: `Missing ${!appsScriptUrl ? 'APPS_SCRIPT_URL' : ''} ${!scriptSecret ? 'SCRIPT_SECRET' : ''}`.trim(),
        note: 'SCRIPT_SECRET environment variable must match V.07 Apps Script SCRIPT_SECRET property',
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

      console.log('[EDGE FUNCTION] 📖 Request body received for V.07 transformation:', {
        bodyLength: bodyText.length,
        bodyPreview: bodyText.substring(0, 500),
        isEmpty: bodyText.trim().length === 0,
        targetFormat: 'V.07-two-layer-secret-payload',
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
      
      console.log('[EDGE FUNCTION] 📋 Parsed request payload for V.07 compatibility:', {
        parsedPayload: JSON.stringify(originalPayload, null, 2),
        hasAction: !!originalPayload.action,
        action: originalPayload.action,
        hasUserId: !!originalPayload.user_id,
        hasUserConfig: !!originalPayload.userConfig,
        willBecomePayloadLayer: 'This will become the inner payload in V.07 two-layer structure',
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

    // Get user email from Supabase profiles table - CRITICAL FOR V.07
    let userEmail = null;
    if (originalPayload.user_id) {
      console.log('[EDGE FUNCTION] 📧 Fetching user email for V.07 two-layer format:', {
        user_id: originalPayload.user_id,
        hasAuthHeader: !!authHeader,
        supabaseAuth: 'Using service role key for profile lookup',
        note: 'User email is CRITICAL for V.07 two-layer payload',
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
        console.error('[EDGE FUNCTION] 📧 CRITICAL: User email lookup failed for V.07:', {
          user_id: originalPayload.user_id,
          authPresent: !!authHeader,
          errorType: 'MISSING_USER_EMAIL_V07',
          impact: 'V.07 Apps Script requires authenticated user email',
          request_id: debugInfo.request_id,
          timestamp: new Date().toISOString()
        });
        
        logNetworkEvent('USER_EMAIL_NOT_FOUND', {
          user_id: originalPayload.user_id,
          request_id: debugInfo.request_id
        });
        return createCorsResponse({
          error: 'User email not found in profiles table',
          details: 'V.07 Apps Script requires user email to execute flows',
          debug_info: {
            user_id: originalPayload.user_id,
            version: 'V.07',
            requirement: 'authenticated_user_email'
          },
          request_id: debugInfo.request_id
        }, 400);
      }

      console.log('[EDGE FUNCTION] ✅ User email retrieved for V.07 payload:', {
        user_id: originalPayload.user_id,
        hasEmail: !!userEmail,
        emailLength: userEmail ? userEmail.length : 0,
        authMethod: 'service-role-lookup',
        willBeInPayloadLayer: true,
        criticalForV07: true,
        request_id: debugInfo.request_id,
        timestamp: new Date().toISOString()
      });
    }

    // Create V.07 compatible two-layer payload for Apps Script
    console.log('[EDGE FUNCTION] 🔧 Building V.07 compatible two-layer Apps Script payload...');
    const twoLayerPayload = buildAppsScriptPayload(
      originalPayload,
      userEmail,
      scriptSecret,  // SCRIPT_SECRET for V.07 compatibility
      debugInfo.request_id
    );

    console.log('[EDGE FUNCTION] 🚀 Calling V.07 Apps Script with enhanced email handling:', {
      userEmail: userEmail,
      flowName: twoLayerPayload.payload?.userConfig?.flowName,
      driveFolder: twoLayerPayload.payload?.userConfig?.driveFolder,
      authMethod: 'V.07-compatible-two-layer-secret-payload',
      hasSecret: !!twoLayerPayload.secret,
      hasPayload: !!twoLayerPayload.payload,
      innerAction: twoLayerPayload.payload?.action,
      emailFieldsProvided: {
        userEmail: !!twoLayerPayload.payload?.userEmail,
        authenticatedUserEmail: !!twoLayerPayload.payload?.authenticatedUserEmail,
        user_email: !!twoLayerPayload.payload?.user_email
      },
      request_id: debugInfo.request_id,
      timestamp: new Date().toISOString()
    });

    logNetworkEvent('CALLING_APPS_SCRIPT', {
      userEmail: userEmail,
      flowName: twoLayerPayload.payload?.userConfig?.flowName,
      driveFolder: twoLayerPayload.payload?.userConfig?.driveFolder,
      format: 'V.07-compatible-two-layer-secret-payload',
      emailFieldsCount: 3,
      request_id: debugInfo.request_id
    });

    // Call Apps Script with V.07 compatible format
    try {
      const appsScriptData = await callAppsScript(
        appsScriptUrl,
        twoLayerPayload,
        debugInfo.request_id
      );

      const totalDuration = Date.now() - startTime;

      console.log('[EDGE FUNCTION] ✅ V.07 Apps Script call successful:', {
        status: appsScriptData.status,
        attachments: appsScriptData.data?.attachments || 0,
        total_duration: totalDuration,
        authMethod: appsScriptData.data?.authMethod || 'V.07-two-layer',
        version: appsScriptData.version,
        processingTime: appsScriptData.processing_time,
        userEmailHandled: !!userEmail,
        request_id: debugInfo.request_id,
        timestamp: new Date().toISOString()
      });

      logNetworkEvent('SUCCESS', {
        status: appsScriptData.status,
        attachments: appsScriptData.data?.attachments || 0,
        total_duration: totalDuration,
        format: 'V.07-compatible-two-layer-secret-payload',
        request_id: debugInfo.request_id
      });

      // Process the response using the V.07 compatible response processor
      const processedResponse = processAppsScriptResponse(
        appsScriptData,
        userEmail,
        debugInfo.request_id,
        totalDuration
      );

      console.log('[EDGE FUNCTION] 📤 Returning processed V.07 response:', {
        responseType: processedResponse.success ? 'success' : 'error',
        hasAppsScriptResponse: !!processedResponse.apps_script_response,
        authMethod: processedResponse.auth_method,
        version: processedResponse.apps_script_response?.version,
        userEmailProcessed: !!userEmail,
        request_id: debugInfo.request_id,
        timestamp: new Date().toISOString()
      });

      return createCorsResponse(processedResponse, 200);

    } catch (appsScriptError) {
      const totalDuration = Date.now() - startTime;
      
      console.error('[EDGE FUNCTION] ❌ V.07 Apps Script call failed:', {
        error: appsScriptError.message,
        request_id: debugInfo.request_id,
        total_duration: totalDuration,
        authMethod: 'V.07-compatible-two-layer-secret-payload',
        userEmailProvided: !!userEmail,
        sentPayloadStructure: {
          hasSecret: !!twoLayerPayload.secret,
          hasPayload: !!twoLayerPayload.payload,
          innerAction: twoLayerPayload.payload?.action,
          emailFieldsCount: [
            twoLayerPayload.payload?.userEmail,
            twoLayerPayload.payload?.authenticatedUserEmail,
            twoLayerPayload.payload?.user_email
          ].filter(Boolean).length
        },
        timestamp: new Date().toISOString()
      });
      
      logNetworkEvent('APPS_SCRIPT_ERROR', {
        error: appsScriptError.message,
        request_id: debugInfo.request_id,
        total_duration: totalDuration,
        format: 'V.07-compatible-two-layer-secret-payload'
      });
      
      return createCorsResponse({
        error: 'V.07 Apps Script execution failed',
        details: appsScriptError.message,
        request_id: debugInfo.request_id,
        total_duration: totalDuration,
        debug_info: {
          user_id: originalPayload.user_id,
          user_email: userEmail,
          apps_script_url: appsScriptUrl,
          auth_method: 'V.07-compatible-two-layer-secret-payload',
          email_fields_provided: 3,
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
