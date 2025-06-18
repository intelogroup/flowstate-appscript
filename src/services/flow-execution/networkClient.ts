
import { supabase } from '@/integrations/supabase/client';
import { FlowExecutionErrorHandler } from './errorHandling';

export class NetworkClient {
  private static readonly EDGE_FUNCTION_URL = 'https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/apps-script-proxy';

  static async makeAuthenticatedRequest(payload: any): Promise<Response> {
    console.log('[FLOW EXECUTION] 🔐 Checking authentication state...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (!session || !session.access_token) {
      const authError = FlowExecutionErrorHandler.createAuthError(
        'No valid Supabase session found',
        { hasSession: !!session, sessionError }
      );
      FlowExecutionErrorHandler.logError(authError, 'Authentication check');
      throw new Error(`Authentication required: ${authError.message}`);
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pa3Jvc25ya2d4bGJic2pkYmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjMwMzcsImV4cCI6MjA2NTU5OTAzN30.mrTrjtKDsS99v87pr64Gt1Rib6JU5V9gIfdly4bl9J0',
      'x-debug-source': 'flow-execution-service-enhanced',
      'x-user-agent': navigator.userAgent || 'unknown'
    };

    console.log('[FLOW EXECUTION] 📤 Making request with enhanced tracking...');
    const fetchStartTime = Date.now();

    try {
      const response = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      const fetchDuration = Date.now() - fetchStartTime;
      console.log('[FLOW EXECUTION] 📥 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        fetchDuration: `${fetchDuration}ms`,
        timestamp: new Date().toISOString()
      });

      return response;

    } catch (fetchError) {
      const networkError = FlowExecutionErrorHandler.createNetworkError(
        `Network request failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        { fetchError }
      );
      FlowExecutionErrorHandler.logError(networkError, 'Network request');
      throw new Error(networkError.message);
    }
  }

  static async processResponse(response: Response): Promise<any> {
    if (!response.ok) {
      let errorText;
      try {
        errorText = await response.text();
        const httpError = FlowExecutionErrorHandler.createNetworkError(
          `HTTP ${response.status}: ${errorText}`,
          { status: response.status, statusText: response.statusText }
        );
        FlowExecutionErrorHandler.logError(httpError, 'HTTP response');
      } catch (textError) {
        errorText = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorText);
    }

    try {
      const responseText = await response.text();
      console.log('[FLOW EXECUTION] 📋 Raw response:', {
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 500),
        timestamp: new Date().toISOString()
      });
      
      return JSON.parse(responseText);
    } catch (parseError) {
      const jsonError = FlowExecutionErrorHandler.createAppsScriptError(
        'Invalid JSON response from server',
        { parseError }
      );
      FlowExecutionErrorHandler.logError(jsonError, 'JSON parsing');
      throw new Error(jsonError.message);
    }
  }
}
