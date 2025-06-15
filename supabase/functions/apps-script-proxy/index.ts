
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FlowRequest {
  action: 'set_flow' | 'run_flow';
  flowId?: string;
}

interface AppsScriptPayload {
  action: string;
  userConfig: any;
  googleTokens: {
    access_token: string;
    refresh_token: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with JWT from request
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log('Authenticated user:', user.email);

    // Parse request body
    const { action, flowId }: FlowRequest = await req.json();

    if (action === 'set_flow') {
      // For set_flow, we just confirm the flow was saved (already handled by frontend)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Flow configuration saved successfully' 
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    if (action === 'run_flow' && flowId) {
      // Fetch user configuration from database
      const { data: userConfig, error: configError } = await supabase
        .from('user_configurations')
        .select('*')
        .eq('id', flowId)
        .eq('user_id', user.id)
        .single();

      if (configError || !userConfig) {
        console.error('Config fetch error:', configError);
        return new Response(
          JSON.stringify({ error: 'Flow configuration not found' }), 
          { 
            status: 404, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          }
        );
      }

      console.log('Retrieved user config:', userConfig.flow_name);

      // Get Google OAuth tokens from user's session
      // Note: In a real implementation, you'd store refresh tokens securely
      // and refresh access tokens as needed
      const { data: session } = await supabase.auth.getSession();
      
      if (!session?.session?.provider_token) {
        return new Response(
          JSON.stringify({ error: 'Google OAuth token not found. Please re-authenticate with Google.' }), 
          { 
            status: 401, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          }
        );
      }

      // Prepare payload for Apps Script
      const appsScriptPayload: AppsScriptPayload = {
        action: 'process_gmail_flow',
        userConfig: {
          flowName: userConfig.flow_name,
          emailFilter: userConfig.email_filter,
          driveFolder: userConfig.drive_folder,
          fileTypes: userConfig.file_types,
          userId: user.id
        },
        googleTokens: {
          access_token: session.session.provider_token,
          refresh_token: session.session.provider_refresh_token || ''
        }
      };

      // Call Apps Script Web App
      // TODO: Replace with your actual Apps Script Web App URL
      const appsScriptUrl = Deno.env.get('APPS_SCRIPT_WEB_APP_URL');
      
      if (!appsScriptUrl) {
        return new Response(
          JSON.stringify({ error: 'Apps Script URL not configured' }), 
          { 
            status: 500, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          }
        );
      }

      console.log('Calling Apps Script:', appsScriptUrl);

      const appsScriptResponse = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appsScriptPayload),
      });

      if (!appsScriptResponse.ok) {
        console.error('Apps Script error:', appsScriptResponse.status, await appsScriptResponse.text());
        return new Response(
          JSON.stringify({ error: 'Failed to execute Gmail flow' }), 
          { 
            status: 500, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          }
        );
      }

      const appsScriptResult = await appsScriptResponse.json();
      console.log('Apps Script result:', appsScriptResult);

      return new Response(
        JSON.stringify(appsScriptResult),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }), 
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error('Error in apps-script-proxy function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
