
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    // Get the session from the Authorization header
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      console.error('No authorization token provided')
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Received token:', token.substring(0, 20) + '...')

    // Get user from token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) {
      console.error('Invalid user token:', userError)
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('User authenticated successfully:', user.email)
    console.log('User app metadata:', user.app_metadata)

    // For Google OAuth users, we need to get provider tokens from user metadata or session
    // Since getSession() doesn't work in edge functions, we'll work with what we have
    const isGoogleUser = user.app_metadata?.provider === 'google'
    
    if (!isGoogleUser) {
      console.error('User is not authenticated via Google')
      return new Response(
        JSON.stringify({ 
          error: 'Google OAuth required. Please sign in with Google to access Gmail and Drive.',
          requiresGoogleAuth: true 
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // For now, we'll use the access token as the provider token
    // This is a simplified approach - in production you might want to store provider tokens separately
    const providerToken = token

    console.log('Google user verified, provider token available')

    // Parse request body
    const { action, flowId } = await req.json()

    // Get the Apps Script Web App URL from environment
    const appsScriptUrl = Deno.env.get('APPS_SCRIPT_WEB_APP_URL')
    if (!appsScriptUrl) {
      console.error('APPS_SCRIPT_WEB_APP_URL not configured')
      return new Response(
        JSON.stringify({ error: 'Apps Script URL not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (action === 'run_flow') {
      // Get flow configuration from database
      const { data: flowConfig, error: flowError } = await supabaseClient
        .from('user_configurations')
        .select('*')
        .eq('id', flowId)
        .eq('user_id', user.id)
        .single()

      if (flowError || !flowConfig) {
        console.error('Flow not found or access denied:', flowError)
        return new Response(
          JSON.stringify({ error: 'Flow not found or access denied' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      console.log('Executing flow:', flowConfig.flow_name)

      // Prepare payload for Apps Script
      const payload = {
        action: 'run_flow',
        user_id: user.id,
        access_token: providerToken,
        flow_config: {
          flow_name: flowConfig.flow_name,
          email_filter: flowConfig.email_filter,
          drive_folder: flowConfig.drive_folder,
          file_types: flowConfig.file_types || []
        }
      }

      console.log('Calling Apps Script with payload:', { 
        action: payload.action, 
        user_id: payload.user_id,
        flow_name: payload.flow_config.flow_name,
        token_present: !!payload.access_token
      })

      // Call Apps Script
      const appsScriptResponse = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!appsScriptResponse.ok) {
        const errorText = await appsScriptResponse.text()
        console.error('Apps Script error:', appsScriptResponse.status, errorText)
        
        // Handle specific Google API errors
        if (appsScriptResponse.status === 401) {
          return new Response(
            JSON.stringify({ 
              error: 'Google authentication expired. Please sign in with Google again.',
              requiresReauth: true 
            }),
            { 
              status: 401, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        if (appsScriptResponse.status === 403) {
          return new Response(
            JSON.stringify({ 
              error: 'Google API access denied. Please ensure you grant Gmail and Drive permissions.',
              requiresPermissions: true 
            }),
            { 
              status: 403, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        return new Response(
          JSON.stringify({ error: `Apps Script error: ${errorText}` }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const result = await appsScriptResponse.json()
      console.log('Apps Script execution result:', result)

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
      console.log('Flow setup confirmed for user:', user.email)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Flow setup confirmed',
          user_id: user.id 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
