
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-debug-source, x-user-agent',
}

// Enhanced logging function
const logWithTimestamp = (level: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const emoji = level === 'ERROR' ? '🔴' : level === 'SUCCESS' ? '✅' : level === 'WARN' ? '⚠️' : '🔍';
  console.log(`${emoji} [${timestamp}] [${level}] ${message}`);
  if (data) {
    console.log(`📊 [${timestamp}] [DATA] ${JSON.stringify(data, null, 2)}`);
  }
};

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  logWithTimestamp('INFO', `=== REQUEST START [${requestId}] ===`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    logWithTimestamp('INFO', `CORS preflight request handled [${requestId}]`);
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    logWithTimestamp('INFO', `Processing ${req.method} request to ${req.url} [${requestId}]`);
    
    // Log all request headers for debugging
    const requestHeaders = Object.fromEntries(req.headers.entries());
    logWithTimestamp('INFO', `Request headers [${requestId}]:`, requestHeaders);

    // Create supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    logWithTimestamp('INFO', `Supabase config [${requestId}]:`, {
      url_present: !!supabaseUrl,
      key_present: !!supabaseKey,
      url_preview: supabaseUrl?.substring(0, 30) + '...'
    });

    const supabaseClient = createClient(
      supabaseUrl ?? '',
      supabaseKey ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Parse request body with comprehensive error handling
    let requestBody;
    try {
      const bodyText = await req.text();
      logWithTimestamp('INFO', `Raw request body length: ${bodyText.length} chars [${requestId}]`);
      
      if (!bodyText.trim()) {
        throw new Error('Empty request body');
      }
      
      requestBody = JSON.parse(bodyText);
      logWithTimestamp('SUCCESS', `Request body parsed successfully [${requestId}]`, {
        keys: Object.keys(requestBody),
        action: requestBody.action,
        flowId: requestBody.flowId,
        has_access_token: !!requestBody.access_token,
        token_length: requestBody.access_token?.length
      });
    } catch (parseError) {
      logWithTimestamp('ERROR', `Failed to parse request body [${requestId}]:`, {
        error: parseError.message,
        error_type: parseError.constructor.name
      });
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body', 
          details: parseError.message,
          request_id: requestId
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Enhanced token extraction and validation with multiple sources
    logWithTimestamp('INFO', `Starting token extraction [${requestId}]`);
    
    let token = null;
    let tokenSource = 'none';

    // Method 1: Authorization header
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      logWithTimestamp('INFO', `Authorization header found [${requestId}]: ${authHeader.substring(0, 20)}...`);
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '');
        tokenSource = 'auth_header';
        logWithTimestamp('SUCCESS', `Token extracted from Authorization header [${requestId}]: ${token.substring(0, 20)}...${token.substring(token.length - 10)} (${token.length} chars)`);
      } else {
        logWithTimestamp('WARN', `Authorization header doesn't start with 'Bearer ' [${requestId}]`);
      }
    } else {
      logWithTimestamp('WARN', `No Authorization header found [${requestId}]`);
    }
    
    // Method 2: Request body access_token
    if (!token && requestBody.access_token) {
      token = requestBody.access_token;
      tokenSource = 'request_body';
      logWithTimestamp('SUCCESS', `Token extracted from request body [${requestId}]: ${token.substring(0, 20)}...${token.substring(token.length - 10)} (${token.length} chars)`);
    }

    // Method 3: Direct token field
    if (!token && requestBody.token) {
      token = requestBody.token;
      tokenSource = 'body_token_field';
      logWithTimestamp('SUCCESS', `Token extracted from body token field [${requestId}]: ${token.substring(0, 20)}...${token.substring(token.length - 10)} (${token.length} chars)`);
    }

    if (!token) {
      logWithTimestamp('ERROR', `NO TOKEN FOUND from any source [${requestId}]`, {
        auth_header_present: !!authHeader,
        body_access_token_present: !!requestBody.access_token,
        body_token_present: !!requestBody.token,
        body_keys: Object.keys(requestBody || {}),
        headers_keys: Object.keys(requestHeaders)
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Authorization required', 
          details: 'No token found in Authorization header or request body',
          request_id: requestId,
          debug: {
            checked_auth_header: !!authHeader,
            checked_body_access_token: !!requestBody?.access_token,
            checked_body_token: !!requestBody?.token,
            available_body_keys: Object.keys(requestBody || {}),
            available_header_keys: Object.keys(requestHeaders)
          }
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    logWithTimestamp('SUCCESS', `Token validated from ${tokenSource} [${requestId}]`, {
      source: tokenSource,
      length: token.length,
      preview: token.substring(0, 30) + '...',
      suffix: '...' + token.substring(token.length - 10)
    });

    // Enhanced user authentication with detailed logging
    logWithTimestamp('INFO', `Attempting user authentication [${requestId}]`);
    const authStartTime = performance.now();
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    const authEndTime = performance.now();
    
    logWithTimestamp('INFO', `Authentication completed in ${Math.round(authEndTime - authStartTime)}ms [${requestId}]`, {
      has_user: !!user,
      has_error: !!userError,
      user_id: user?.id,
      user_email: user?.email,
      user_provider: user?.app_metadata?.provider,
      error_message: userError?.message,
      error_status: userError?.status
    });

    if (userError || !user) {
      logWithTimestamp('ERROR', `Authentication failed [${requestId}]:`, {
        error_message: userError?.message,
        error_code: userError?.status,
        token_length: token.length,
        token_preview: token.substring(0, 20) + '...',
        token_source: tokenSource
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Invalid authentication token',
          details: userError?.message || 'No user found',
          request_id: requestId,
          debug: {
            token_length: token.length,
            token_preview: token.substring(0, 20) + '...',
            token_source: tokenSource,
            error_code: userError?.status,
            supabase_error: userError?.message
          }
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    logWithTimestamp('SUCCESS', `User authenticated successfully [${requestId}]`, {
      user_id: user.id,
      user_email: user.email,
      provider: user.app_metadata?.provider,
      created_at: user.created_at,
      last_sign_in: user.last_sign_in_at
    });

    // Enhanced Google OAuth validation
    const isGoogleUser = user.app_metadata?.provider === 'google';
    logWithTimestamp('INFO', `Google OAuth validation [${requestId}]:`, {
      is_google_user: isGoogleUser,
      provider: user.app_metadata?.provider,
      all_providers: user.app_metadata?.providers || [],
      has_app_metadata: !!user.app_metadata
    });
    
    if (!isGoogleUser) {
      logWithTimestamp('ERROR', `Non-Google user attempted access [${requestId}]:`, {
        current_provider: user.app_metadata?.provider,
        required_provider: 'google',
        user_id: user.id,
        user_email: user.email
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Google OAuth required. Please sign in with Google to access Gmail and Drive.',
          requiresGoogleAuth: true,
          request_id: requestId,
          debug: {
            current_provider: user.app_metadata?.provider,
            user_id: user.id,
            user_email: user.email
          }
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Provider token setup and validation
    const providerToken = token; // Using access token as provider token
    logWithTimestamp('SUCCESS', `Provider token setup completed [${requestId}]:`, {
      using_access_token_as_provider: true,
      token_length: providerToken.length,
      token_preview: providerToken.substring(0, 30) + '...'
    });

    // Parse and validate request details
    const { action, flowId } = requestBody;
    logWithTimestamp('INFO', `Request details parsed [${requestId}]:`, {
      action: action,
      flow_id: flowId,
      has_debug_info: !!requestBody.debug_info,
      debug_keys: requestBody.debug_info ? Object.keys(requestBody.debug_info) : []
    });

    // Get and validate Apps Script URL
    const appsScriptUrl = Deno.env.get('APPS_SCRIPT_WEB_APP_URL');
    logWithTimestamp('INFO', `Apps Script URL validation [${requestId}]:`, {
      url_present: !!appsScriptUrl,
      url_length: appsScriptUrl?.length,
      url_preview: appsScriptUrl ? appsScriptUrl.substring(0, 50) + '...' : 'NOT SET'
    });
    
    if (!appsScriptUrl) {
      logWithTimestamp('ERROR', `Apps Script URL not configured [${requestId}]`);
      return new Response(
        JSON.stringify({ 
          error: 'Apps Script URL not configured',
          details: 'APPS_SCRIPT_WEB_APP_URL environment variable is missing',
          request_id: requestId
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (action === 'run_flow') {
      logWithTimestamp('INFO', `Processing run_flow action [${requestId}] for flow: ${flowId}`);
      
      // Get flow configuration from database
      logWithTimestamp('INFO', `Fetching flow configuration from database [${requestId}]`);
      const dbQueryStart = performance.now();
      
      const { data: flowConfig, error: flowError } = await supabaseClient
        .from('user_configurations')
        .select('*')
        .eq('id', flowId)
        .eq('user_id', user.id)
        .single()

      const dbQueryEnd = performance.now();
      logWithTimestamp('INFO', `Database query completed in ${Math.round(dbQueryEnd - dbQueryStart)}ms [${requestId}]`, {
        flow_found: !!flowConfig,
        has_error: !!flowError,
        error_message: flowError?.message
      });

      if (flowConfig) {
        logWithTimestamp('SUCCESS', `Flow configuration retrieved [${requestId}]:`, {
          flow_id: flowConfig.id,
          flow_name: flowConfig.flow_name,
          email_filter: flowConfig.email_filter,
          drive_folder: flowConfig.drive_folder,
          file_types: flowConfig.file_types || [],
          auto_run: flowConfig.auto_run,
          created_at: flowConfig.created_at
        });
      }

      if (flowError || !flowConfig) {
        logWithTimestamp('ERROR', `Flow configuration error [${requestId}]:`, {
          error: flowError?.message,
          flow_id: flowId,
          user_id: user.id,
          query_error: flowError?.message
        });
        
        return new Response(
          JSON.stringify({ 
            error: 'Flow not found or access denied',
            details: flowError?.message || 'Flow not found',
            request_id: requestId,
            debug: {
              flow_id: flowId,
              user_id: user.id,
              query_error: flowError?.message
            }
          }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Prepare comprehensive payload for Apps Script
      const payload = {
        action: 'run_flow',
        user_id: user.id,
        access_token: providerToken,
        flow_config: {
          flow_name: flowConfig.flow_name,
          email_filter: flowConfig.email_filter,
          drive_folder: flowConfig.drive_folder,
          file_types: flowConfig.file_types || []
        },
        debug_info: {
          request_id: requestId,
          request_timestamp: new Date().toISOString(),
          user_email: user.email,
          provider: user.app_metadata?.provider,
          token_source: tokenSource,
          token_length: providerToken.length,
          edge_function_version: '3.0-enhanced-debug',
          flow_id: flowConfig.id,
          user_agent: req.headers.get('X-User-Agent') || 'unknown',
          debug_source: req.headers.get('X-Debug-Source') || 'unknown',
          original_debug_info: requestBody.debug_info || {}
        }
      };

      logWithTimestamp('INFO', `Prepared Apps Script payload [${requestId}]:`, {
        action: payload.action,
        user_id: payload.user_id,
        flow_name: payload.flow_config.flow_name,
        token_present: !!payload.access_token,
        token_length: payload.access_token.length,
        debug_keys: Object.keys(payload.debug_info)
      });

      // Call Apps Script with comprehensive error handling and logging
      logWithTimestamp('INFO', `Calling Apps Script API [${requestId}]`);
      let appsScriptResponse;
      
      try {
        const appsScriptStart = performance.now();
        
        appsScriptResponse = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            'X-User-ID': user.id,
            'X-Flow-ID': flowId
          },
          body: JSON.stringify(payload)
        });

        const appsScriptEnd = performance.now();
        const responseTime = Math.round(appsScriptEnd - appsScriptStart);
        
        logWithTimestamp('INFO', `Apps Script HTTP response received [${requestId}]:`, {
          status: appsScriptResponse.status,
          status_text: appsScriptResponse.statusText,
          ok: appsScriptResponse.ok,
          response_time_ms: responseTime,
          headers: Object.fromEntries(appsScriptResponse.headers.entries())
        });

      } catch (fetchError) {
        logWithTimestamp('ERROR', `Apps Script fetch failed [${requestId}]:`, {
          error_name: fetchError.name,
          error_message: fetchError.message,
          error_stack: fetchError.stack?.substring(0, 300),
          apps_script_url: appsScriptUrl
        });
        
        return new Response(
          JSON.stringify({ 
            error: 'Failed to call Apps Script',
            details: fetchError.message,
            request_id: requestId,
            debug: {
              apps_script_url: appsScriptUrl,
              fetch_error: fetchError.toString(),
              error_type: fetchError.constructor.name
            }
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Handle non-OK responses with detailed logging
      if (!appsScriptResponse.ok) {
        let errorText;
        try {
          errorText = await appsScriptResponse.text();
          logWithTimestamp('ERROR', `Apps Script error response [${requestId}]:`, {
            status: appsScriptResponse.status,
            status_text: appsScriptResponse.statusText,
            error_text: errorText,
            error_text_length: errorText.length
          });
        } catch (textError) {
          logWithTimestamp('ERROR', `Failed to read Apps Script error response [${requestId}]:`, {
            text_error: textError.message
          });
          errorText = 'Unable to read error response';
        }
        
        // Enhanced error categorization with detailed logging
        if (appsScriptResponse.status === 401) {
          logWithTimestamp('ERROR', `Apps Script authentication error [${requestId}]`);
          return new Response(
            JSON.stringify({ 
              error: 'Google authentication expired. Please sign in with Google again.',
              requiresReauth: true,
              request_id: requestId,
              debug: {
                apps_script_status: appsScriptResponse.status,
                error_text: errorText
              }
            }),
            { 
              status: 401, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        if (appsScriptResponse.status === 403) {
          logWithTimestamp('ERROR', `Apps Script permission error [${requestId}]`);
          return new Response(
            JSON.stringify({ 
              error: 'Google API access denied. Please ensure you grant Gmail and Drive permissions.',
              requiresPermissions: true,
              request_id: requestId,
              debug: {
                apps_script_status: appsScriptResponse.status,
                error_text: errorText
              }
            }),
            { 
              status: 403, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        logWithTimestamp('ERROR', `Generic Apps Script error [${requestId}]:`, {
          status: appsScriptResponse.status,
          status_text: appsScriptResponse.statusText,
          error_text: errorText
        });
        
        return new Response(
          JSON.stringify({ 
            error: `Apps Script error: ${errorText}`,
            request_id: requestId,
            debug: {
              status: appsScriptResponse.status,
              status_text: appsScriptResponse.statusText,
              error_text: errorText
            }
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Parse successful response with enhanced logging
      let result;
      try {
        const responseText = await appsScriptResponse.text();
        logWithTimestamp('INFO', `Apps Script response text [${requestId}]:`, {
          text_length: responseText.length,
          text_preview: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : '')
        });
        
        result = JSON.parse(responseText);
        logWithTimestamp('SUCCESS', `Apps Script response parsed successfully [${requestId}]:`, {
          result_keys: Object.keys(result),
          result_preview: JSON.stringify(result).substring(0, 300) + '...'
        });
      } catch (jsonError) {
        logWithTimestamp('ERROR', `Failed to parse Apps Script success response [${requestId}]:`, {
          json_error: jsonError.message,
          json_error_type: jsonError.constructor.name
        });
        
        const textResponse = await appsScriptResponse.text();
        logWithTimestamp('ERROR', `Raw response text [${requestId}]:`, {
          raw_text: textResponse
        });
        
        return new Response(
          JSON.stringify({ 
            error: 'Invalid JSON response from Apps Script',
            details: jsonError.message,
            request_id: requestId,
            raw_response: textResponse
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      logWithTimestamp('SUCCESS', `Flow execution completed successfully [${requestId}]!`);
      return new Response(
        JSON.stringify({
          ...result,
          request_id: requestId,
          processing_time: new Date().toISOString()
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Handle other actions (like set_flow)
    if (action === 'set_flow') {
      logWithTimestamp('INFO', `Processing set_flow action [${requestId}] for user: ${user.email}`);
      
      const response = { 
        success: true, 
        message: 'Flow setup confirmed',
        user_id: user.id,
        request_id: requestId,
        timestamp: new Date().toISOString()
      }
      
      logWithTimestamp('SUCCESS', `Flow setup completed [${requestId}]:`, response);
      
      return new Response(
        JSON.stringify(response),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    logWithTimestamp('ERROR', `Unknown action received [${requestId}]:`, {
      received_action: action,
      supported_actions: ['run_flow', 'set_flow']
    });
    
    return new Response(
      JSON.stringify({ 
        error: 'Unknown action',
        received_action: action,
        supported_actions: ['run_flow', 'set_flow'],
        request_id: requestId
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    logWithTimestamp('ERROR', `=== UNEXPECTED ERROR IN EDGE FUNCTION [${requestId}] ===`, {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack,
      error_constructor: error.constructor.name,
      error_toString: error.toString()
    });
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        request_id: requestId,
        debug: {
          error_name: error.name,
          error_message: error.message,
          timestamp: new Date().toISOString()
        }
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } finally {
    logWithTimestamp('INFO', `=== REQUEST END [${requestId}] ===`);
  }
})
