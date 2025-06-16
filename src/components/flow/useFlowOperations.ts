
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserFlow {
  id: string;
  flow_name: string;
  email_filter: string;
  drive_folder: string;
  file_types: string[];
  auto_run: boolean;
  frequency: string;
  created_at: string;
}

export const useFlowOperations = (
  addDebugInfo: (message: string, isError?: boolean) => void,
  logSessionDetails: () => void
) => {
  const [runningFlows, setRunningFlows] = useState<Set<string>>(new Set());
  const [authError, setAuthError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, session } = useAuth();

  const runFlow = useCallback(async (flow: UserFlow) => {
    addDebugInfo(`🚀 === STARTING FLOW EXECUTION: ${flow.flow_name} ===`);
    setAuthError(null);
    setRunningFlows(prev => new Set(prev).add(flow.id));

    try {
      // Step 1: Session validation
      addDebugInfo("📋 Step 1: Session validation");
      if (!session) {
        const errorMsg = "No session found - user needs to sign in";
        addDebugInfo(`❌ ${errorMsg}`, true);
        setAuthError(errorMsg);
        toast({
          title: "🔴 Authentication Required",
          description: errorMsg,
          variant: "destructive"
        });
        return;
      }

      // Step 2: Detailed session logging
      addDebugInfo("📋 Step 2: Detailed session analysis");
      logSessionDetails();

      // Step 3: Token preparation
      addDebugInfo("📋 Step 3: Token preparation");
      const authToken = session.access_token;
      
      if (!authToken) {
        const errorMsg = "No access token in session - re-authentication required";
        addDebugInfo(`❌ ${errorMsg}`, true);
        setAuthError(errorMsg);
        toast({
          title: "🔴 Token Missing",
          description: errorMsg,
          variant: "destructive"
        });
        return;
      }

      addDebugInfo(`✅ Token ready: ${authToken.substring(0, 20)}...${authToken.substring(authToken.length - 10)} (${authToken.length} chars)`);

      // Step 4: Payload preparation
      addDebugInfo("📋 Step 4: Payload preparation");
      const basePayload = {
        action: 'run_flow',
        flowId: flow.id,
        access_token: authToken,
        debug_info: {
          timestamp: new Date().toISOString(),
          user_id: session.user?.id,
          user_email: session.user?.email,
          provider: session.user?.app_metadata?.provider,
          token_length: authToken.length,
          token_preview: authToken.substring(0, 20) + '...',
          flow_name: flow.flow_name,
          has_provider_token: !!session.provider_token,
          session_expires: session.expires_at,
          attempt_number: 1
        }
      };

      addDebugInfo(`📦 Payload prepared with ${Object.keys(basePayload).length} keys`);
      addDebugInfo(`🎯 Target flow: ${flow.flow_name} (ID: ${flow.id})`);

      // Step 5: Primary method attempt
      addDebugInfo("📋 Step 5: Primary method - supabase.functions.invoke");
      let response;
      let attemptMethod = "primary";
      
      try {
        addDebugInfo("🌐 Calling supabase.functions.invoke...");
        
        const invokeStartTime = performance.now();
        response = await supabase.functions.invoke('apps-script-proxy', {
          body: basePayload,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'X-Debug-Source': 'flowmanager-primary',
            'X-User-Agent': 'FlowState-WebApp/1.0'
          }
        });
        const invokeEndTime = performance.now();

        addDebugInfo(`⏱️ Primary method completed in ${Math.round(invokeEndTime - invokeStartTime)}ms`);
        addDebugInfo(`📊 Response status: ${response.error ? 'ERROR' : 'SUCCESS'}`);
        
        if (response.error) {
          addDebugInfo(`❌ Primary method error details:`, true);
          addDebugInfo(`  - Error: ${JSON.stringify(response.error)}`, true);
          addDebugInfo(`  - Error type: ${typeof response.error}`, true);
          addDebugInfo(`  - Error message: ${response.error.message || 'No message'}`, true);
        } else {
          addDebugInfo(`✅ Primary method success data:`);
          addDebugInfo(`  - Data keys: ${response.data ? Object.keys(response.data).join(', ') : 'No data'}`);
        }

      } catch (invokeError) {
        addDebugInfo(`💥 Primary method threw exception:`, true);
        addDebugInfo(`  - Error name: ${invokeError.name}`, true);
        addDebugInfo(`  - Error message: ${invokeError.message}`, true);
        addDebugInfo(`  - Error stack: ${invokeError.stack?.substring(0, 200)}...`, true);
        
        // Step 6: Fallback method
        addDebugInfo("📋 Step 6: Fallback method - direct fetch");
        attemptMethod = "fallback";
        
        try {
          const edgeFunctionUrl = `https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/apps-script-proxy`;
          addDebugInfo(`🌐 Fallback URL: ${edgeFunctionUrl}`);
          
          const fallbackPayload = {
            ...basePayload,
            debug_info: {
              ...basePayload.debug_info,
              fallback_attempt: true,
              primary_error: invokeError.message,
              method: 'direct_fetch',
              attempt_number: 2
            }
          };

          addDebugInfo("📤 Making direct fetch request...");
          const fetchStartTime = performance.now();
          
          const fetchResponse = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pa3Jvc25ya2d4bGJic2pkYmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjMwMzcsImV4cCI6MjA2NTU5OTAzN30.mrTrjtKDsS99v87pr64Gt1Rib6JU5V9gIfdly4bl9J0',
              'X-Debug-Source': 'flowmanager-fallback',
              'X-User-Agent': 'FlowState-WebApp/1.0'
            },
            body: JSON.stringify(fallbackPayload)
          });

          const fetchEndTime = performance.now();
          addDebugInfo(`⏱️ Fallback method completed in ${Math.round(fetchEndTime - fetchStartTime)}ms`);
          addDebugInfo(`📊 Fallback response status: ${fetchResponse.status} ${fetchResponse.statusText}`);
          
          const responseHeaders = Object.fromEntries(fetchResponse.headers.entries());
          addDebugInfo(`📋 Fallback response headers: ${JSON.stringify(responseHeaders)}`);

          let responseData;
          const responseText = await fetchResponse.text();
          addDebugInfo(`📄 Raw response length: ${responseText.length} chars`);
          
          try {
            responseData = JSON.parse(responseText);
            addDebugInfo(`✅ Successfully parsed JSON response`);
          } catch (jsonError) {
            addDebugInfo(`❌ Failed to parse JSON: ${jsonError.message}`, true);
            addDebugInfo(`📄 Response text preview: ${responseText.substring(0, 500)}...`, true);
            throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
          }

          response = {
            data: fetchResponse.ok ? responseData : null,
            error: fetchResponse.ok ? null : { 
              message: responseData.error || `HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`,
              status: fetchResponse.status,
              details: responseData
            }
          };

          addDebugInfo(`📊 Fallback method result: ${fetchResponse.ok ? 'SUCCESS' : 'ERROR'}`);

        } catch (fetchError) {
          addDebugInfo(`💥 Fallback method also failed:`, true);
          addDebugInfo(`  - Error name: ${fetchError.name}`, true);
          addDebugInfo(`  - Error message: ${fetchError.message}`, true);
          throw fetchError;
        }
      }

      // Step 7: Response analysis
      addDebugInfo(`📋 Step 7: Response analysis (${attemptMethod} method)`);
      addDebugInfo(`🔍 Response structure analysis:`);
      addDebugInfo(`  - Has error: ${!!response.error}`);
      addDebugInfo(`  - Has data: ${!!response.data}`);
      addDebugInfo(`  - Response type: ${typeof response}`);

      if (response.error) {
        addDebugInfo(`❌ === ERROR ANALYSIS ===`, true);
        const errorMessage = response.error.message || 'Unknown error';
        const errorStatus = response.error.status || 'Unknown status';
        
        addDebugInfo(`🔍 Error details:`, true);
        addDebugInfo(`  - Message: "${errorMessage}"`, true);
        addDebugInfo(`  - Status: ${errorStatus}`, true);
        addDebugInfo(`  - Full error: ${JSON.stringify(response.error)}`, true);
        
        // Enhanced error categorization
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid authentication token') || errorStatus === 401) {
          const authErrorMsg = "🔐 Google authentication has expired. Please sign in with Google again to refresh your permissions.";
          addDebugInfo(`🔐 Authentication error detected: ${authErrorMsg}`, true);
          setAuthError(authErrorMsg);
          toast({
            title: "🔴 Authentication Expired",
            description: authErrorMsg,
            variant: "destructive"
          });
          return;
        }
        
        if (errorMessage.includes('Google OAuth token not found') || errorMessage.includes('requiresGoogleAuth') || errorMessage.includes('Google OAuth required')) {
          const googleAuthMsg = "🔗 Google authentication is required. Please sign in with Google to access Gmail and Drive.";
          addDebugInfo(`🔗 Google OAuth error: ${googleAuthMsg}`, true);
          setAuthError(googleAuthMsg);
          toast({
            title: "🔴 Google Authentication Required",
            description: googleAuthMsg,
            variant: "destructive"
          });
          return;
        }

        if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('requiresPermissions') || errorStatus === 403) {
          const permissionMsg = "🚫 Google permissions denied. Please ensure you grant access to Gmail and Drive when signing in.";
          addDebugInfo(`🚫 Permission error: ${permissionMsg}`, true);
          setAuthError(permissionMsg);
          toast({
            title: "🔴 Permissions Required",
            description: permissionMsg,
            variant: "destructive"
          });
          return;
        }

        // Generic error handling
        addDebugInfo(`💥 Unhandled error category: ${errorMessage}`, true);
        toast({
          title: "🔴 Flow Execution Failed",
          description: `Error: ${errorMessage}`,
          variant: "destructive"
        });
        return;
      }

      // Step 8: Success handling
      addDebugInfo(`✅ === SUCCESS ANALYSIS ===`);
      addDebugInfo(`🎉 Flow execution completed successfully!`);
      addDebugInfo(`📊 Success data details:`);
      
      if (response.data) {
        addDebugInfo(`  - Data keys: ${Object.keys(response.data).join(', ')}`);
        addDebugInfo(`  - Data preview: ${JSON.stringify(response.data).substring(0, 200)}...`);
      }

      toast({
        title: "🎉 Flow Executed Successfully!",
        description: `${flow.flow_name} has been executed. Check your Google Drive folder for the saved attachments.`,
      });

      addDebugInfo(`🏁 === FLOW EXECUTION COMPLETED SUCCESSFULLY ===`);

    } catch (error) {
      addDebugInfo(`💥 === UNEXPECTED ERROR IN FLOW EXECUTION ===`, true);
      addDebugInfo(`🔍 Error analysis:`, true);
      addDebugInfo(`  - Error name: ${error.name}`, true);
      addDebugInfo(`  - Error message: ${error.message}`, true);
      addDebugInfo(`  - Error type: ${typeof error}`, true);
      addDebugInfo(`  - Error constructor: ${error.constructor.name}`, true);
      
      if (error.stack) {
        addDebugInfo(`  - Stack trace: ${error.stack.substring(0, 300)}...`, true);
      }
      
      console.error('🔴 Complete error object:', error);
      
      toast({
        title: "🔴 Unexpected Error",
        description: `An unexpected error occurred: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setRunningFlows(prev => {
        const newSet = new Set(prev);
        newSet.delete(flow.id);
        console.log(`[FLOW DEBUG] Flow execution cleanup completed for: ${flow.flow_name}`);
        return newSet;
      });
    }
  }, [session, addDebugInfo, logSessionDetails, toast]);

  const deleteFlow = useCallback(async (flowId: string) => {
    addDebugInfo(`🗑️ Starting flow deletion: ${flowId}`);
    
    try {
      const { error } = await supabase
        .from('user_configurations')
        .delete()
        .eq('id', flowId)
        .eq('user_id', user?.id);

      if (error) {
        addDebugInfo(`❌ Delete flow error: ${error.message}`, true);
        throw error;
      }

      addDebugInfo(`✅ Flow deleted successfully`);
      toast({
        title: "🗑️ Flow Deleted",
        description: "The flow has been successfully deleted.",
      });

    } catch (error) {
      addDebugInfo(`💥 Delete flow failed: ${error}`, true);
      console.error('Error deleting flow:', error);
      toast({
        title: "🔴 Error",
        description: "Failed to delete the flow.",
        variant: "destructive"
      });
    }
  }, [addDebugInfo, toast, user?.id]);

  return {
    runningFlows,
    authError,
    runFlow,
    deleteFlow
  };
};
