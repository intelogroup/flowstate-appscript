
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-debug-source, x-user-agent, x-flow-id, x-request-source',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
  
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      logWithTimestamp('INFO', `CORS preflight request handled [${requestId}]`);
      return new Response('ok', { headers: corsHeaders })
    }

    logWithTimestamp('INFO', `Processing ${req.method} request to ${req.url} [${requestId}]`);
    
    // Log all request headers for debugging
    const requestHeaders = Object.fromEntries(req.headers.entries());
    logWithTimestamp('INFO', `Request headers [${requestId}]:`, requestHeaders);

    // Create supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      logWithTimestamp('ERROR', `Missing Supabase configuration [${requestId}]`);
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error',
          details: 'Missing Supabase configuration',
          request_id: requestId
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Enhanced request body parsing with better error handling
    let requestBody;
    try {
      const bodyText = await req.text();
      logWithTimestamp('INFO', `Raw request body received [${requestId}]:`, {
        length: bodyText.length,
        preview: bodyText.substring(0, 200) + (bodyText.length > 200 ? '...' : ''),
        content_type: req.headers.get('content-type')
      });
      
      if (!bodyText.trim()) {
        logWithTimestamp('ERROR', `Empty request body received [${requestId}]`);
        return new Response(
          JSON.stringify({ 
            error: 'Empty request body', 
            details: 'Request body is required for flow execution',
            request_id: requestId,
            debug: {
              content_length: req.headers.get('content-length'),
              content_type: req.headers.get('content-type'),
              body_length: bodyText.length,
              method: req.method,
              url: req.url
            }
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      requestBody = JSON.parse(bodyText);
      logWithTimestamp('SUCCESS', `Request body parsed successfully [${requestId}]`, {
        keys: Object.keys(requestBody),
        action: requestBody.action,
        flowId: requestBody.flowId,
        has_access_token: !!requestBody.access_token,
        token_length: requestBody.access_token?.length,
        payload_size: JSON.stringify(requestBody).length
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

    // Enhanced token extraction and validation
    logWithTimestamp('INFO', `Starting token extraction [${requestId}]`);
    
    let token = null;
    let tokenSource = 'none';

    // Method 1: Authorization header
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
      tokenSource = 'auth_header';
      logWithTimestamp('SUCCESS', `Token extracted from Authorization header [${requestId}]`);
    }
    
    // Method 2: Request body access_token
    if (!token && requestBody.access_token) {
      token = requestBody.access_token;
      tokenSource = 'request_body';
      logWithTimestamp('SUCCESS', `Token extracted from request body [${requestId}]`);
    }

    if (!token) {
      logWithTimestamp('ERROR', `NO TOKEN FOUND [${requestId}]`, {
        auth_header_present: !!authHeader,
        body_access_token_present: !!requestBody.access_token,
        body_keys: Object.keys(requestBody || {})
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Authorization required', 
          details: 'No token found in Authorization header or request body',
          request_id: requestId
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    logWithTimestamp('SUCCESS', `Token validated [${requestId}]`, {
      source: tokenSource,
      length: token.length,
      preview: token.substring(0, 20) + '...'
    });

    // Enhanced user authentication
    logWithTimestamp('INFO', `Attempting user authentication [${requestId}]`);
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      logWithTimestamp('ERROR', `Authentication failed [${requestId}]:`, {
        error_message: userError?.message,
        token_source: tokenSource
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Invalid authentication token',
          details: userError?.message || 'No user found',
          request_id: requestId
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
      provider: user.app_metadata?.provider
    });

    // Enhanced Google OAuth validation
    const isGoogleUser = user.app_metadata?.provider === 'google';
    if (!isGoogleUser) {
      logWithTimestamp('ERROR', `Non-Google user attempted access [${requestId}]`);
      return new Response(
        JSON.stringify({ 
          error: 'Google OAuth required. Please sign in with Google to access Gmail and Drive.',
          requiresGoogleAuth: true,
          request_id: requestId
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse and validate request details
    const { action, flowId } = requestBody;
    logWithTimestamp('INFO', `Request details [${requestId}]:`, {
      action: action,
      flow_id: flowId,
      has_debug_info: !!requestBody.debug_info
    });

    // Validate required fields
    if (!action) {
      logWithTimestamp('ERROR', `Missing action field [${requestId}]`);
      return new Response(
        JSON.stringify({ 
          error: 'Missing action field',
          request_id: requestId
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get and validate Apps Script URL
    const appsScriptUrl = Deno.env.get('APPS_SCRIPT_WEB_APP_URL');
    logWithTimestamp('INFO', `Apps Script URL validation [${requestId}]:`, {
      url_present: !!appsScriptUrl,
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
      
      if (!flowId) {
        logWithTimestamp('ERROR', `Missing flowId [${requestId}]`);
        return new Response(
          JSON.stringify({ 
            error: 'Missing flowId',
            request_id: requestId
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      // Get flow configuration from database
      const { data: flowConfig, error: flowError } = await supabaseClient
        .from('user_configurations')
        .select('*')
        .eq('id', flowId)
        .eq('user_id', user.id)
        .single()

      if (flowError || !flowConfig) {
        logWithTimestamp('ERROR', `Flow not found [${requestId}]:`, {
          error: flowError?.message,
          flow_id: flowId,
          user_id: user.id
        });
        
        return new Response(
          JSON.stringify({ 
            error: 'Flow not found or access denied',
            request_id: requestId
          }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      logWithTimestamp('SUCCESS', `Flow configuration retrieved [${requestId}]:`, {
        flow_name: flowConfig.flow_name,
        email_filter: flowConfig.email_filter
      });

      // Prepare payload for Apps Script
      const payload = {
        action: 'run_flow',
        user_id: user.id,
        access_token: token,
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
          token_length: token.length,
          edge_function_version: '4.0-network-fixed',
          flow_id: flowConfig.id,
          original_debug_info: requestBody.debug_info || {}
        }
      };

      logWithTimestamp('INFO', `Prepared Apps Script payload [${requestId}]:`, {
        action: payload.action,
        flow_name: payload.flow_config.flow_name,
        payload_size: JSON.stringify(payload).length
      });

      // Call Apps Script with enhanced error handling
      try {
        logWithTimestamp('INFO', `Calling Apps Script API [${requestId}]`);
        
        const appsScriptResponse = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            'X-User-ID': user.id,
            'X-Flow-ID': flowId
          },
          body: JSON.stringify(payload)
        });

        logWithTimestamp('INFO', `Apps Script response [${requestId}]:`, {
          status: appsScriptResponse.status,
          ok: appsScriptResponse.ok,
          statusText: appsScriptResponse.statusText
        });

        if (!appsScriptResponse.ok) {
          const errorText = await appsScriptResponse.text();
          logWithTimestamp('ERROR', `Apps Script error [${requestId}]:`, {
            status: appsScriptResponse.status,
            statusText: appsScriptResponse.statusText,
            error_text: errorText
          });
          
          return new Response(
            JSON.stringify({ 
              error: `Apps Script error (${appsScriptResponse.status}): ${errorText}`,
              request_id: requestId,
              apps_script_status: appsScriptResponse.status
            }),
            { 
              status: 502, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        const result = await appsScriptResponse.json();
        logWithTimestamp('SUCCESS', `Apps Script success [${requestId}]`, {
          result_keys: Object.keys(result || {})
        });
        
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

      } catch (fetchError) {
        logWithTimestamp('ERROR', `Apps Script fetch failed [${requestId}]:`, {
          error: fetchError.message,
          error_name: fetchError.name,
          error_stack: fetchError.stack
        });
        
        return new Response(
          JSON.stringify({ 
            error: 'Failed to call Apps Script',
            details: fetchError.message,
            error_type: fetchError.name,
            request_id: requestId
          }),
          { 
            status: 502, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Handle other actions
    if (action === 'set_flow') {
      const response = { 
        success: true, 
        message: 'Flow setup confirmed',
        user_id: user.id,
        request_id: requestId
      }
      
      return new Response(
        JSON.stringify(response),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    logWithTimestamp('ERROR', `Unknown action [${requestId}]: ${action}`);
    return new Response(
      JSON.stringify({ 
        error: 'Unknown action',
        received_action: action,
        request_id: requestId
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    logWithTimestamp('ERROR', `=== UNEXPECTED ERROR [${requestId}] ===`, {
      error_message: error.message,
      error_name: error.name,
      error_stack: error.stack
    });
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        error_type: error.name,
        request_id: requestId
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
