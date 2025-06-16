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

      // Step 4: Payload preparation with explicit structure
      addDebugInfo("📋 Step 4: Payload preparation with explicit structure");
      const requestPayload = {
        action: 'run_flow',
        flowId: flow.id,
        access_token: authToken,
        debug_info: {
          timestamp: new Date().toISOString(),
          user_id: session.user?.id,
          user_email: session.user?.email,
          provider: session.user?.app_metadata?.provider,
          flow_name: flow.flow_name,
          client_version: '6.0-fixed-payload',
          request_source: 'frontend-flowmanager'
        }
      };

      addDebugInfo(`📦 Payload prepared with ${Object.keys(requestPayload).length} keys`);
      addDebugInfo(`🎯 Target flow: ${flow.flow_name} (ID: ${flow.id})`);
      addDebugInfo(`📏 Payload size: ${JSON.stringify(requestPayload).length} characters`);

      // Step 5: Primary method with corrected body parameter
      addDebugInfo("📋 Step 5: Primary method - supabase.functions.invoke with body");
      let response;
      
      try {
        addDebugInfo("🌐 Calling supabase.functions.invoke with explicit body...");
        
        const invokeStartTime = performance.now();
        response = await supabase.functions.invoke('apps-script-proxy', {
          body: requestPayload
        });
        const invokeEndTime = performance.now();

        addDebugInfo(`⏱️ Primary method completed in ${Math.round(invokeEndTime - invokeStartTime)}ms`);
        addDebugInfo(`📊 Response status: ${response.error ? 'ERROR' : 'SUCCESS'}`);
        
        if (response.error) {
          addDebugInfo(`❌ Primary method error details:`, true);
          addDebugInfo(`- Error: ${JSON.stringify(response.error)}`, true);
          addDebugInfo(`- Error type: ${typeof response.error}`, true);
          addDebugInfo(`- Error message: ${response.error.message}`, true);
          addDebugInfo(`- Error name: ${response.error.name}`, true);
          
          // Check for network-level errors that require fallback
          if (response.error.name === 'FunctionsFetchError') {
            addDebugInfo(`🔄 Network error detected, trying fallback method`, true);
            throw new Error(`Network error: ${response.error.message}`);
          }
        } else {
          addDebugInfo(`✅ Primary method successful`);
          addDebugInfo(`📊 Response data: ${response.data ? 'Present' : 'None'}`);
        }

      } catch (invokeError) {
        addDebugInfo(`💥 Primary method failed:`, true);
        addDebugInfo(`- Error: ${invokeError.message}`, true);
        
        // Step 6: Fallback method using direct fetch with proper headers
        addDebugInfo("📋 Step 6: Fallback method - direct fetch with enhanced headers");
        
        try {
          const fallbackUrl = `https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/apps-script-proxy`;
          addDebugInfo(`🌐 Fallback URL: ${fallbackUrl}`);
          
          const fallbackPayload = {
            ...requestPayload,
            debug_info: {
              ...requestPayload.debug_info,
              fallback_attempt: true,
              primary_error: invokeError.message,
              fallback_timestamp: new Date().toISOString()
            }
          };
          
          const fallbackStartTime = performance.now();
          
          const fetchResponse = await fetch(fallbackUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pa3Jvc25ya2d4bGJic2pkYmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjMwMzcsImV4cCI6MjA2NTU5OTAzN30.mrTrjtKDsS99v87pr64Gt1Rib6JU5V9gIfdly4bl9J0',
              'x-debug-source': 'flowmanager-fallback',
              'x-user-agent': 'FlowState-WebApp/1.0-fallback'
            },
            body: JSON.stringify(fallbackPayload)
          });

          const fallbackEndTime = performance.now();
          addDebugInfo(`⏱️ Fallback method completed in ${Math.round(fallbackEndTime - fallbackStartTime)}ms`);
          addDebugInfo(`📊 Fallback response status: ${fetchResponse.status}`);

          if (!fetchResponse.ok) {
            const errorText = await fetchResponse.text();
            addDebugInfo(`❌ Fallback method failed: ${fetchResponse.status}`, true);
            addDebugInfo(`❌ Error response: ${errorText}`, true);
            
            toast({
              title: "🔴 Network Connection Error",
              description: "Both primary and fallback methods failed. Please check your connection.",
              variant: "destructive"
            });
            return;
          }

          const responseData = await fetchResponse.json();
          response = {
            data: responseData,
            error: null
          };

          addDebugInfo(`✅ Fallback method successful`);

        } catch (fetchError) {
          addDebugInfo(`💥 Fallback method also failed:`, true);
          addDebugInfo(`- Error: ${fetchError.message}`, true);
          
          toast({
            title: "🔴 Complete Network Failure",
            description: "Unable to reach the Edge Function. Please try again later.",
            variant: "destructive"
          });
          return;
        }
      }

      // Step 7: Response analysis
      addDebugInfo(`📋 Step 7: Response analysis`);
      addDebugInfo(`🔍 Response structure analysis:`);
      addDebugInfo(`- Has error: ${!!response.error}`);
      addDebugInfo(`- Has data: ${!!response.data}`);
      addDebugInfo(`- Response type: ${typeof response}`);
      
      if (response.error) {
        addDebugInfo(`❌ === ERROR ANALYSIS ===`, true);
        const errorMessage = response.error.message || 'Unknown error';
        
        addDebugInfo(`🔍 Error details:`, true);
        addDebugInfo(`- Name: "${response.error.name}"`, true);
        addDebugInfo(`- Message: "${errorMessage}"`, true);
        addDebugInfo(`- Status: ${response.error.status || 'Unknown status'}`, true);
        addDebugInfo(`- Full error: ${JSON.stringify(response.error)}`, true);
        
        // Enhanced error categorization
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
          const authErrorMsg = "🔐 Authentication expired. Please sign in again.";
          addDebugInfo(authErrorMsg, true);
          setAuthError(authErrorMsg);
          toast({
            title: "🔴 Authentication Expired",
            description: authErrorMsg,
            variant: "destructive"
          });
          return;
        }
        
        if (errorMessage.includes('Google OAuth') || errorMessage.includes('requiresGoogleAuth')) {
          const googleAuthMsg = "🔗 Google authentication required. Please sign in with Google.";
          addDebugInfo(googleAuthMsg, true);
          setAuthError(googleAuthMsg);
          toast({
            title: "🔴 Google Authentication Required",
            description: googleAuthMsg,
            variant: "destructive"
          });
          return;
        }

        if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          const permissionMsg = "🚫 Google permissions denied. Please grant access to Gmail and Drive.";
          addDebugInfo(permissionMsg, true);
          setAuthError(permissionMsg);
          toast({
            title: "🔴 Permissions Required",
            description: permissionMsg,
            variant: "destructive"
          });
          return;
        }

        // Check for specific error patterns
        if (errorMessage.includes('Empty request body')) {
          addDebugInfo(`💥 Request body transmission failed - payload not sent`, true);
          toast({
            title: "🔴 Request Transmission Failed",
            description: "The request payload was not transmitted properly. Please try again.",
            variant: "destructive"
          });
          return;
        }

        addDebugInfo(`💥 Unhandled error category: ${errorMessage}`, true);
        addDebugInfo(`💥 Error context: ${JSON.stringify(response.error.context || {})}`, true);

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
        addDebugInfo(`📊 Success data received`);
        addDebugInfo(`📋 Response keys: ${Object.keys(response.data).join(', ')}`);
      }

      toast({
        title: "🎉 Flow Executed Successfully!",
        description: `${flow.flow_name} has been executed. Check your Google Drive folder.`,
      });

      addDebugInfo(`🏁 === FLOW EXECUTION COMPLETED SUCCESSFULLY ===`);

    } catch (error) {
      addDebugInfo(`💥 === UNEXPECTED ERROR ===`, true);
      addDebugInfo(`🔍 Error: ${error.message}`, true);
      addDebugInfo(`🔍 Error type: ${error.constructor.name}`, true);
      
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
