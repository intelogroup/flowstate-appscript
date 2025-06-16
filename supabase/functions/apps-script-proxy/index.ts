
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface FlowConfig {
  emailFilter: string
  driveFolder: string
  fileTypes?: string[]
  userId?: string
  flowName?: string
}

interface RequestBody {
  action: string
  userConfig: FlowConfig
  googleTokens?: any
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Edge Function called:', req.method)

    // Get environment variables
    const appsScriptUrl = Deno.env.get('APPS_SCRIPT_URL')
    const appsScriptSecret = Deno.env.get('APPS_SCRIPT_SECRET')

    if (!appsScriptUrl) {
      console.error('❌ Missing APPS_SCRIPT_URL environment variable')
      return new Response(
        JSON.stringify({
          error: 'Configuration error: APPS_SCRIPT_URL not set',
          troubleshooting: {
            message: 'Environment variable missing',
            steps: [
              '1. Set APPS_SCRIPT_URL in your Supabase Edge Function secrets',
              '2. Use your Apps Script web app deployment URL',
              '3. Format: https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
            ]
          }
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!appsScriptSecret) {
      console.error('❌ Missing APPS_SCRIPT_SECRET environment variable')
      return new Response(
        JSON.stringify({
          error: 'Configuration error: APPS_SCRIPT_SECRET not set',
          troubleshooting: {
            message: 'Secret token missing',
            steps: [
              '1. Run setupScriptSecret() in your Apps Script to generate a secret',
              '2. Copy the generated secret',
              '3. Set it as APPS_SCRIPT_SECRET in Supabase Edge Function secrets'
            ]
          }
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    let requestBody: RequestBody
    try {
      requestBody = await req.json()
      console.log('📝 Request parsed:', {
        action: requestBody.action,
        hasUserConfig: !!requestBody.userConfig,
        flowName: requestBody.userConfig?.flowName
      })
    } catch (error) {
      console.error('❌ Failed to parse request body:', error)
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON in request body',
          details: error.message
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate request
    if (!requestBody.action || !requestBody.userConfig) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: action and userConfig',
          received: Object.keys(requestBody)
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Prepare payload for Apps Script
    const payload = {
      auth_token: appsScriptSecret, // ✅ CORRECT: Send secret in JSON body
      action: requestBody.action,
      userConfig: requestBody.userConfig,
      googleTokens: requestBody.googleTokens || null
    }

    console.log('📤 Calling Apps Script:', {
      url: appsScriptUrl,
      action: payload.action,
      userConfig: {
        emailFilter: payload.userConfig.emailFilter,
        driveFolder: payload.userConfig.driveFolder,
        fileTypes: payload.userConfig.fileTypes,
        flowName: payload.userConfig.flowName
      }
    })

    // Call Apps Script
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    console.log('📥 Apps Script response status:', response.status)

    if (!response.ok) {
      const responseText = await response.text()
      console.error('❌ Apps Script error:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText.substring(0, 500)
      })

      // Check if it's an HTML response (login page)
      const isHtmlResponse = responseText.trim().startsWith('<!DOCTYPE') || 
                           responseText.trim().startsWith('<html')

      return new Response(
        JSON.stringify({
          error: `Apps Script error (${response.status}): ${
            isHtmlResponse 
              ? 'Apps Script deployment requires authentication - check deployment settings' 
              : response.statusText || 'Unknown error'
          }`,
          request_id: crypto.randomUUID(),
          apps_script_status: response.status,
          troubleshooting: {
            message: isHtmlResponse 
              ? 'Apps Script deployment requires authentication - check deployment settings'
              : 'Apps Script returned an error',
            steps: isHtmlResponse ? [
              '1. Go to your Apps Script project',
              '2. Click Deploy → Manage deployments', 
              '3. Click the gear icon to edit deployment settings',
              '4. Set "Execute as" to "Me" (NOT "User accessing the web app")', // ✅ FIXED
              '5. Set "Who has access" to "Anyone"',
              '6. Click Deploy and use the new URL',
              '7. Test the URL in browser - you should see JSON, not HTML'
            ] : [
              '1. Check Apps Script logs for detailed error information',
              '2. Verify the secret token matches between Supabase and Apps Script',
              '3. Ensure your Apps Script code handles the request properly'
            ]
          },
          apps_script_url: appsScriptUrl,
          error_details: responseText.substring(0, 200),
          auth_method: 'body-based',
          has_secret_configured: !!appsScriptSecret
        }),
        { 
          status: 502, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse Apps Script response
    let appsScriptData
    try {
      const responseText = await response.text()
      appsScriptData = JSON.parse(responseText)
      console.log('✅ Apps Script success:', {
        status: appsScriptData.status,
        message: appsScriptData.message,
        dataKeys: Object.keys(appsScriptData.data || {})
      })
    } catch (error) {
      console.error('❌ Failed to parse Apps Script response:', error)
      return new Response(
        JSON.stringify({
          error: 'Apps Script returned invalid JSON',
          details: error.message
        }),
        { 
          status: 502, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Return successful response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Flow processed successfully',
        timestamp: new Date().toISOString(),
        apps_script_response: appsScriptData
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Edge Function error:', error)
    return new Response(
      JSON.stringify({
        error: 'Edge Function internal error',
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
