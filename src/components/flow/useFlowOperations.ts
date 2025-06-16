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

      // Step 4: Enhanced payload preparation
      addDebugInfo("📋 Step 4: Enhanced payload preparation");
      const requestPayload = {
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
          attempt_number: 1,
          client_version: '3.0-fixed-payload'
        }
      };

      // Validate payload before sending
      if (!requestPayload.action || !requestPayload.flowId || !requestPayload.access_token) {
        const errorMsg = "Invalid payload - missing required fields";
        addDebugInfo(`❌ ${errorMsg}`, true);
        addDebugInfo(`  - Action: ${!!requestPayload.action}`, true);
        addDebugInfo(`  - FlowId: ${!!requestPayload.flowId}`, true);
        addDebugInfo(`  - Access Token: ${!!requestPayload.access_token}`, true);
        toast({
          title: "🔴 Payload Error",
          description: errorMsg,
          variant: "destructive"
        });
        return;
      }

      addDebugInfo(`📦 Enhanced payload prepared with ${Object.keys(requestPayload).length} keys`);
      addDebugInfo(`🎯 Target flow: ${flow.flow_name} (ID: ${flow.id})`);
      addDebugInfo(`📋 Payload size: ${JSON.stringify(requestPayload).length} characters`);

      // Step 5: Enhanced primary method with better error handling
      addDebugInfo("📋 Step 5: Primary method - supabase.functions.invoke with enhanced error handling");
      let response;
      let attemptMethod = "primary";
      
      try {
        addDebugInfo("🌐 Calling supabase.functions.invoke with proper payload...");
        addDebugInfo(`📤 Sending payload: ${JSON.stringify(requestPayload).substring(0, 150)}...`);
        
        const invokeStartTime = performance.now();
        response = await supabase.functions.invoke('apps-script-proxy', {
          body: requestPayload,
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Source': 'flowmanager-primary-v4',
            'X-User-Agent': 'FlowState-WebApp/4.0',
            'X-Flow-ID': flow.id,
            'X-Request-Source': 'web-client-v4'
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
          addDebugInfo(`  - Error name: ${response.error.name || 'Unknown'}`, true);
          addDebugInfo(`  - Error context: ${JSON.stringify(response.error.context || {})}`, true);

          // Check if this is a network-level error (FunctionsFetchError)
          if (response.error.name === 'FunctionsFetchError') {
            addDebugInfo(`🔄 Network error detected, trying fallback method immediately`, true);
            throw new Error(`Network error: ${response.error.message}`);
          }
        } else {
          addDebugInfo(`✅ Primary method success data:`);
          addDebugInfo(`  - Data keys: ${response.data ? Object.keys(response.data).join(', ') : 'No data'}`);
        }

      } catch (invokeError) {
        addDebugInfo(`💥 Primary method threw exception:`, true);
        addDebugInfo(`  - Error name: ${invokeError.name}`, true);
        addDebugInfo(`  - Error message: ${invokeError.message}`, true);
        
        // Step 6: Enhanced fallback method with direct URL and better error handling
        addDebugInfo("📋 Step 6: Enhanced fallback method - direct fetch with full URL");
        attemptMethod = "fallback";
        
        try {
          const edgeFunctionUrl = `https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/apps-script-proxy`;
          addDebugInfo(`🌐 Fallback URL: ${edgeFunctionUrl}`);
          
          const fallbackPayload = {
            ...requestPayload,
            debug_info: {
              ...requestPayload.debug_info,
              fallback_attempt: true,
              primary_error: invokeError.message,
              method: 'direct_fetch_v4',
              attempt_number: 2
            }
          };

          addDebugInfo("📤 Making direct fetch request with full URL...");
          addDebugInfo(`📋 Fallback payload size: ${JSON.stringify(fallbackPayload).length} characters`);
          
          const fetchStartTime = performance.now();
          
          const fetchResponse = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pa3Jvc25ya2d4bGJic2pkYmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjMwMzcsImV4cCI6MjA2NTU5OTAzN30.mrTrjtKDsS99v87pr64Gt1Rib6JU5V9gIfdly4bl9J0',
              'X-Debug-Source': 'flowmanager-fallback-v4',
              'X-User-Agent': 'FlowState-WebApp/4.0',
              'X-Flow-ID': flow.id,
              'X-Request-Source': 'web-client-fallback-v4'
            },
            body: JSON.stringify(fallbackPayload)
          });

          const fetchEndTime = performance.now();
          addDebugInfo(`⏱️ Fallback method completed in ${Math.round(fetchEndTime - fetchStartTime)}ms`);
          addDebugInfo(`📊 Fallback response status: ${fetchResponse.status} ${fetchResponse.statusText}`);

          let responseData;
          const responseText = await fetchResponse.text();
          addDebugInfo(`📄 Raw response length: ${responseText.length} chars`);
          addDebugInfo(`📄 Raw response preview: ${responseText.substring(0, 200)}...`);
          
          try {
            responseData = JSON.parse(responseText);
            addDebugInfo(`✅ Successfully parsed JSON response`);
          } catch (jsonError) {
            addDebugInfo(`❌ Failed to parse JSON: ${jsonError.message}`, true);
            addDebugInfo(`❌ Response text: ${responseText}`, true);
            throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
          }

          response = {
            data: fetchResponse.ok ? responseData : null,
            error: fetchResponse.ok ? null : { 
              message: responseData.error || `HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`,
              status: fetchResponse.status,
              details: responseData,
              name: 'HTTPError'
            }
          };

          addDebugInfo(`📊 Fallback method result: ${fetchResponse.ok ? 'SUCCESS' : 'ERROR'}`);

        } catch (fetchError) {
          addDebugInfo(`💥 Fallback method also failed:`, true);
          addDebugInfo(`  - Error message: ${fetchError.message}`, true);
          addDebugInfo(`  - Error name: ${fetchError.name}`, true);
          
          // If both methods fail, provide helpful error message
          toast({
            title: "🔴 Network Connection Error",
            description: "Both primary and fallback methods failed. Please check your internet connection and try again.",
            variant: "destructive"
          });
          return;
        }
      }

      // Step 7: Enhanced response analysis
      addDebugInfo(`📋 Step 7: Enhanced response analysis (${attemptMethod} method)`);
      
      if (response.error) {
        addDebugInfo(`❌ === ERROR ANALYSIS ===`, true);
        const errorMessage = response.error.message || 'Unknown error';
        const errorStatus = response.error.status || 'Unknown status';
        const errorName = response.error.name || 'Unknown error type';
        
        addDebugInfo(`🔍 Error details:`, true);
        addDebugInfo(`  - Name: "${errorName}"`, true);
        addDebugInfo(`  - Message: "${errorMessage}"`, true);
        addDebugInfo(`  - Status: ${errorStatus}`, true);
        
        // Enhanced error categorization
        if (errorMessage.includes('401') || 
            errorMessage.includes('Unauthorized') || 
            errorStatus === 401) {
          const authErrorMsg = "🔐 Google authentication has expired. Please sign in with Google again.";
          addDebugInfo(`🔐 Authentication error: ${authErrorMsg}`, true);
          setAuthError(authErrorMsg);
          toast({
            title: "🔴 Authentication Expired",
            description: authErrorMsg,
            variant: "destructive"
          });
          return;
        }
        
        if (errorMessage.includes('Google OAuth') || 
            errorMessage.includes('requiresGoogleAuth')) {
          const googleAuthMsg = "🔗 Google authentication required. Please sign in with Google.";
          addDebugInfo(`🔗 Google OAuth error: ${googleAuthMsg}`, true);
          setAuthError(googleAuthMsg);
          toast({
            title: "🔴 Google Authentication Required",
            description: googleAuthMsg,
            variant: "destructive"
          });
          return;
        }

        if (errorMessage.includes('403') || 
            errorMessage.includes('Forbidden') || 
            errorStatus === 403) {
          const permissionMsg = "🚫 Google permissions denied. Please grant access to Gmail and Drive.";
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
      
      if (response.data) {
        addDebugInfo(`📊 Success data: ${JSON.stringify(response.data).substring(0, 200)}...`);
      }

      toast({
        title: "🎉 Flow Executed Successfully!",
        description: `${flow.flow_name} has been executed. Check your Google Drive folder for saved attachments.`,
      });

      addDebugInfo(`🏁 === FLOW EXECUTION COMPLETED SUCCESSFULLY ===`);

    } catch (error) {
      addDebugInfo(`💥 === UNEXPECTED ERROR ===`, true);
      addDebugInfo(`🔍 Error: ${error.message}`, true);
      addDebugInfo(`🔍 Error name: ${error.name}`, true);
      
      toast({
        title: "🔴 Unexpected Error",
        description: `An unexpected error occurred: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setRunningFlows(prev => {
        const newSet = new Set(prev);
        newSet.delete(flow.id);
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
