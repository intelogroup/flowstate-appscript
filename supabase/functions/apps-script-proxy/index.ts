
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled successfully')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 === EDGE FUNCTION EXECUTION START ===')
    console.log(`📥 Request method: ${req.method}`)
    console.log(`🌐 Request URL: ${req.url}`)
    console.log(`📋 Request headers:`, Object.fromEntries(req.headers.entries()))

    // Create supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    console.log(`🔗 Supabase client created with URL: ${Deno.env.get('SUPABASE_URL')}`)

    // Parse request body with error handling
    let requestBody;
    try {
      requestBody = await req.json()
      console.log(`📦 Request body parsed successfully:`, JSON.stringify(requestBody, null, 2))
    } catch (parseError) {
      console.error(`❌ Failed to parse request body:`, parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body', details: parseError.message }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Enhanced token extraction and validation
    let token = req.headers.get('Authorization')?.replace('Bearer ', '')
    console.log(`🔑 Authorization header token present: ${!!token}`)
    
    if (token) {
      console.log(`🔑 Token from header - Length: ${token.length}, Preview: ${token.substring(0, 30)}...${token.substring(token.length - 10)}`)
    }
    
    if (!token && requestBody.access_token) {
      console.log(`🔄 No Authorization header, extracting token from request body`)
      token = requestBody.access_token
      console.log(`🔑 Token from body - Length: ${token.length}, Preview: ${token.substring(0, 30)}...${token.substring(token.length - 10)}`)
    }

    if (!token) {
      console.error('❌ NO TOKEN FOUND - Missing in both header and body')
      console.log('📋 Available request body keys:', Object.keys(requestBody || {}))
      console.log('📋 Authorization header:', req.headers.get('Authorization'))
      
      return new Response(
        JSON.stringify({ 
          error: 'Authorization required', 
          details: 'No token found in Authorization header or request body',
          debug: {
            hasAuthHeader: !!req.headers.get('Authorization'),
            hasBodyToken: !!(requestBody?.access_token),
            bodyKeys: Object.keys(requestBody || {})
          }
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`🔐 Using token for authentication: ${token.substring(0, 20)}...`)

    // Enhanced user authentication with detailed logging
    console.log(`👤 Attempting to authenticate user with token...`)
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    console.log(`👤 Authentication result:`)
    console.log(`  - User ID: ${user?.id || 'NONE'}`)
    console.log(`  - User Email: ${user?.email || 'NONE'}`)
    console.log(`  - User Provider: ${user?.app_metadata?.provider || 'NONE'}`)
    console.log(`  - User Created: ${user?.created_at || 'NONE'}`)
    console.log(`  - Auth Error: ${userError?.message || 'NONE'}`)

    if (userError || !user) {
      console.error(`❌ Authentication failed:`)
      console.error(`  - Error Message: ${userError?.message}`)
      console.error(`  - Error Code: ${userError?.status}`)
      console.error(`  - User Object: ${user}`)
      
      return new Response(
        JSON.stringify({ 
          error: 'Invalid authentication token',
          details: userError?.message || 'No user found',
          debug: {
            tokenLength: token.length,
            tokenPreview: token.substring(0, 20) + '...',
            errorCode: userError?.status
          }
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`✅ User authenticated successfully: ${user.email}`)
    console.log(`📊 User metadata:`, JSON.stringify(user.app_metadata, null, 2))

    // Enhanced Google OAuth validation
    const isGoogleUser = user.app_metadata?.provider === 'google'
    console.log(`🔍 Google OAuth check:`)
    console.log(`  - Is Google User: ${isGoogleUser}`)
    console.log(`  - Provider: ${user.app_metadata?.provider}`)
    console.log(`  - All Providers: ${JSON.stringify(user.app_metadata?.providers || [])}`)
    
    if (!isGoogleUser) {
      console.error(`❌ User is not authenticated via Google`)
      console.error(`  - Current Provider: ${user.app_metadata?.provider}`)
      console.error(`  - Required Provider: google`)
      
      return new Response(
        JSON.stringify({ 
          error: 'Google OAuth required. Please sign in with Google to access Gmail and Drive.',
          requiresGoogleAuth: true,
          debug: {
            currentProvider: user.app_metadata?.provider,
            userId: user.id,
            userEmail: user.email
          }
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Provider token validation and setup
    const providerToken = token // Using access token as provider token
    console.log(`🔐 Provider token setup:`)
    console.log(`  - Using access token as provider token`)
    console.log(`  - Token length: ${providerToken.length}`)
    console.log(`  - Token preview: ${providerToken.substring(0, 30)}...`)

    console.log(`✅ Google user verified, proceeding with request processing`)

    // Parse request details
    const { action, flowId } = requestBody
    console.log(`📋 Request details:`)
    console.log(`  - Action: ${action}`)
    console.log(`  - Flow ID: ${flowId}`)
    console.log(`  - Debug Info: ${JSON.stringify(requestBody.debug_info || {})}`)

    // Get the Apps Script Web App URL
    const appsScriptUrl = Deno.env.get('APPS_SCRIPT_WEB_APP_URL')
    console.log(`🔗 Apps Script URL check:`)
    console.log(`  - URL Present: ${!!appsScriptUrl}`)
    console.log(`  - URL: ${appsScriptUrl || 'NOT SET'}`)
    
    if (!appsScriptUrl) {
      console.error(`❌ APPS_SCRIPT_WEB_APP_URL environment variable not configured`)
      return new Response(
        JSON.stringify({ 
          error: 'Apps Script URL not configured',
          details: 'APPS_SCRIPT_WEB_APP_URL environment variable is missing'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (action === 'run_flow') {
      console.log(`🏃‍♂️ Processing run_flow action for flow ID: ${flowId}`)
      
      // Get flow configuration from database with enhanced logging
      console.log(`📊 Fetching flow configuration from database...`)
      const { data: flowConfig, error: flowError } = await supabaseClient
        .from('user_configurations')
        .select('*')
        .eq('id', flowId)
        .eq('user_id', user.id)
        .single()

      console.log(`📊 Database query result:`)
      console.log(`  - Flow found: ${!!flowConfig}`)
      console.log(`  - Query error: ${flowError?.message || 'NONE'}`)
      
      if (flowConfig) {
        console.log(`  - Flow name: ${flowConfig.flow_name}`)
        console.log(`  - Email filter: ${flowConfig.email_filter}`)
        console.log(`  - Drive folder: ${flowConfig.drive_folder}`)
        console.log(`  - File types: ${JSON.stringify(flowConfig.file_types)}`)
      }

      if (flowError || !flowConfig) {
        console.error(`❌ Flow configuration error:`)
        console.error(`  - Error: ${flowError?.message}`)
        console.error(`  - Flow ID: ${flowId}`)
        console.error(`  - User ID: ${user.id}`)
        
        return new Response(
          JSON.stringify({ 
            error: 'Flow not found or access denied',
            details: flowError?.message || 'Flow not found',
            debug: {
              flowId: flowId,
              userId: user.id,
              queryError: flowError?.message
            }
          }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      console.log(`✅ Flow configuration retrieved: ${flowConfig.flow_name}`)

      // Prepare enhanced payload for Apps Script
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
          request_timestamp: new Date().toISOString(),
          user_email: user.email,
          provider: user.app_metadata?.provider,
          fallback_attempt: requestBody.fallback_attempt || false,
          edge_function_version: '2.0-enhanced-logging'
        }
      }

      console.log(`📤 Calling Apps Script with enhanced payload:`)
      console.log(`  - Action: ${payload.action}`)
      console.log(`  - User ID: ${payload.user_id}`)
      console.log(`  - Flow Name: ${payload.flow_config.flow_name}`)
      console.log(`  - Email Filter: ${payload.flow_config.email_filter}`)
      console.log(`  - Drive Folder: ${payload.flow_config.drive_folder}`)
      console.log(`  - File Types: ${JSON.stringify(payload.flow_config.file_types)}`)
      console.log(`  - Token Present: ${!!payload.access_token}`)
      console.log(`  - Token Length: ${payload.access_token.length}`)
      console.log(`  - Apps Script URL: ${appsScriptUrl}`)
      console.log(`  - Debug Info: ${JSON.stringify(payload.debug_info)}`)

      // Call Apps Script with comprehensive error handling
      let appsScriptResponse;
      try {
        console.log(`🌐 Making HTTP request to Apps Script...`)
        appsScriptResponse = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        })

        console.log(`📡 Apps Script HTTP response:`)
        console.log(`  - Status: ${appsScriptResponse.status}`)
        console.log(`  - Status Text: ${appsScriptResponse.statusText}`)
        console.log(`  - Headers: ${JSON.stringify(Object.fromEntries(appsScriptResponse.headers.entries()))}`)
        console.log(`  - OK: ${appsScriptResponse.ok}`)

      } catch (fetchError) {
        console.error(`❌ Failed to call Apps Script:`, fetchError)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to call Apps Script',
            details: fetchError.message,
            debug: {
              appsScriptUrl: appsScriptUrl,
              fetchError: fetchError.toString()
            }
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      if (!appsScriptResponse.ok) {
        let errorText;
        try {
          errorText = await appsScriptResponse.text()
          console.error(`❌ Apps Script error response:`)
          console.error(`  - Status: ${appsScriptResponse.status}`)
          console.error(`  - Error Text: ${errorText}`)
        } catch (textError) {
          console.error(`❌ Failed to read Apps Script error response:`, textError)
          errorText = 'Unable to read error response'
        }
        
        // Enhanced error categorization
        if (appsScriptResponse.status === 401) {
          console.error(`🔐 Authentication error with Google APIs`)
          return new Response(
            JSON.stringify({ 
              error: 'Google authentication expired. Please sign in with Google again.',
              requiresReauth: true,
              debug: {
                appsScriptStatus: appsScriptResponse.status,
                errorText: errorText
              }
            }),
            { 
              status: 401, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        if (appsScriptResponse.status === 403) {
          console.error(`🚫 Permission error with Google APIs`)
          return new Response(
            JSON.stringify({ 
              error: 'Google API access denied. Please ensure you grant Gmail and Drive permissions.',
              requiresPermissions: true,
              debug: {
                appsScriptStatus: appsScriptResponse.status,
                errorText: errorText
              }
            }),
            { 
              status: 403, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        console.error(`💥 Generic Apps Script error`)
        return new Response(
          JSON.stringify({ 
            error: `Apps Script error: ${errorText}`,
            debug: {
              status: appsScriptResponse.status,
              statusText: appsScriptResponse.statusText,
              errorText: errorText
            }
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Parse successful response
      let result;
      try {
        result = await appsScriptResponse.json()
        console.log(`✅ Apps Script success response:`)
        console.log(`  - Response: ${JSON.stringify(result, null, 2)}`)
      } catch (jsonError) {
        console.error(`❌ Failed to parse Apps Script success response:`, jsonError)
        const textResponse = await appsScriptResponse.text()
        console.error(`📄 Raw response text: ${textResponse}`)
        
        return new Response(
          JSON.stringify({ 
            error: 'Invalid JSON response from Apps Script',
            details: jsonError.message,
            rawResponse: textResponse
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      console.log(`🎉 Flow execution completed successfully!`)
      return new Response(
        JSON.stringify(result),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Handle other actions (like set_flow)
    if (action === 'set_flow') {
      console.log(`⚙️ Processing set_flow action for user: ${user.email}`)
      
      const response = { 
        success: true, 
        message: 'Flow setup confirmed',
        user_id: user.id,
        timestamp: new Date().toISOString()
      }
      
      console.log(`✅ Flow setup response: ${JSON.stringify(response)}`)
      
      return new Response(
        JSON.stringify(response),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.error(`❌ Unknown action received: ${action}`)
    return new Response(
      JSON.stringify({ 
        error: 'Unknown action',
        receivedAction: action,
        supportedActions: ['run_flow', 'set_flow']
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('💥 === UNEXPECTED ERROR IN EDGE FUNCTION ===')
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Error toString:', error.toString())
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        debug: {
          errorName: error.name,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        }
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
