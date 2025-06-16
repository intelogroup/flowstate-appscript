
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

// Enhanced retry logic with exponential backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`Retry attempt ${attempt} failed, waiting ${delay}ms before retry`);
      await sleep(delay);
    }
  }
  throw new Error('Max retries exceeded');
};

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

      // Step 2: Enhanced session logging
      addDebugInfo("📋 Step 2: Enhanced session analysis");
      logSessionDetails();

      // Step 3: Token preparation with validation
      addDebugInfo("📋 Step 3: Enhanced token preparation");
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

      // Step 4: Enhanced payload preparation with explicit serialization check
      addDebugInfo("📋 Step 4: Enhanced payload preparation with serialization validation");
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
          client_version: '8.0-enhanced-empty-body-fix',
          request_source: 'frontend-flowmanager-v3',
          network_debug: true,
          retry_enabled: true
        }
      };

      addDebugInfo(`📦 Enhanced payload prepared with ${Object.keys(requestPayload).length} keys`);
      addDebugInfo(`🎯 Target flow: ${flow.flow_name} (ID: ${flow.id})`);
      
      // Validate serialization before sending
      let payloadString: string;
      try {
        payloadString = JSON.stringify(requestPayload);
        addDebugInfo(`📏 Payload serialized successfully: ${payloadString.length} characters`);
        
        // Verify the serialized payload can be parsed back
        JSON.parse(payloadString);
        addDebugInfo(`✅ Payload serialization validated`);
      } catch (serializationError) {
        addDebugInfo(`❌ Payload serialization failed: ${serializationError.message}`, true);
        toast({
          title: "🔴 Payload Error",
          description: "Failed to serialize request data",
          variant: "destructive"
        });
        return;
      }

      // Step 5: Enhanced network operation with request body validation
      addDebugInfo("📋 Step 5: Enhanced network operation with body validation");
      
      const executeRequest = async () => {
        addDebugInfo("🌐 Executing supabase.functions.invoke with validated payload...");
        
        const invokeStartTime = performance.now();
        
        // Log the exact payload being sent
        addDebugInfo(`📤 Sending payload: ${payloadString.substring(0, 100)}...`);
        
        const response = await supabase.functions.invoke('apps-script-proxy', {
          body: requestPayload, // Send the object, not the string
          headers: {
            'Content-Type': 'application/json',
            'x-debug-source': 'flowmanager-enhanced-v3',
            'x-user-agent': 'FlowState-WebApp/8.0-enhanced-empty-body-fix'
          }
        });
        
        const invokeEndTime = performance.now();
        addDebugInfo(`⏱️ Request completed in ${Math.round(invokeEndTime - invokeStartTime)}ms`);
        
        return response;
      };

      let response;
      try {
        response = await retryWithBackoff(executeRequest, 3, 1000);
        
        // Enhanced response logging
        addDebugInfo(`📊 Final response received:`);
        addDebugInfo(`- Has error: ${!!response.error}`);
        addDebugInfo(`- Has data: ${!!response.data}`);
        addDebugInfo(`- Response type: ${typeof response}`);
        
        if (response.data?.request_id) {
          addDebugInfo(`🔍 Request ID: ${response.data.request_id}`);
        }
        
      } catch (retryError) {
        addDebugInfo(`💥 All retry attempts failed:`, true);
        addDebugInfo(`- Final error: ${retryError.message}`, true);
        
        // Enhanced fallback with explicit headers and body validation
        addDebugInfo("📋 Step 6: Enhanced fallback method with validated payload");
        
        try {
          const fallbackUrl = `https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/apps-script-proxy`;
          addDebugInfo(`🌐 Enhanced fallback URL: ${fallbackUrl}`);
          
          const fallbackPayload = {
            ...requestPayload,
            debug_info: {
              ...requestPayload.debug_info,
              fallback_attempt: true,
              primary_error: retryError.message,
              fallback_timestamp: new Date().toISOString(),
              fallback_version: 'v3-enhanced-empty-body-fix'
            }
          };
          
          // Validate fallback payload serialization
          const fallbackPayloadString = JSON.stringify(fallbackPayload);
          addDebugInfo(`📤 Fallback payload size: ${fallbackPayloadString.length} chars`);
          
          const fallbackStartTime = performance.now();
          
          const fetchResponse = await fetch(fallbackUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pa3Jvc25ya2d4bGJic2pkYmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjMwMzcsImV4cCI6MjA2NTU5OTAzN30.mrTrjtKDsS99v87pr64Gt1Rib6JU5V9gIfdly4bl9J0',
              'x-debug-source': 'flowmanager-fallback-enhanced-v3',
              'x-user-agent': 'FlowState-WebApp/8.0-fallback-enhanced',
              'Origin': window.location.origin,
              'Referer': window.location.href
            },
            body: fallbackPayloadString, // Send as string for direct fetch
            mode: 'cors',
            credentials: 'omit'
          });

          const fallbackEndTime = performance.now();
          addDebugInfo(`⏱️ Fallback completed in ${Math.round(fallbackEndTime - fallbackStartTime)}ms`);
          addDebugInfo(`📊 Fallback response: ${fetchResponse.status} ${fetchResponse.statusText}`);

          if (!fetchResponse.ok) {
            const errorText = await fetchResponse.text();
            addDebugInfo(`❌ Fallback failed: ${fetchResponse.status}`, true);
            addDebugInfo(`❌ Error response: ${errorText.substring(0, 200)}`, true);
            
            toast({
              title: "🔴 Network Connection Error",
              description: `Both primary and fallback methods failed. Status: ${fetchResponse.status}`,
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
          if (responseData.request_id) {
            addDebugInfo(`🔍 Fallback Request ID: ${responseData.request_id}`);
          }

        } catch (fetchError) {
          addDebugInfo(`💥 Enhanced fallback also failed:`, true);
          addDebugInfo(`- Error: ${fetchError.message}`, true);
          
          toast({
            title: "🔴 Complete Network Failure",
            description: "Unable to reach the Edge Function. Please check your network connection.",
            variant: "destructive"
          });
          return;
        }
      }

      // Step 7: Enhanced response analysis
      addDebugInfo(`📋 Step 7: Enhanced response analysis`);
      
      if (response.error) {
        addDebugInfo(`❌ === ENHANCED ERROR ANALYSIS ===`, true);
        const errorMessage = response.error.message || 'Unknown error';
        
        addDebugInfo(`🔍 Enhanced error details:`, true);
        addDebugInfo(`- Name: "${response.error.name}"`, true);
        addDebugInfo(`- Message: "${errorMessage}"`, true);
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
        
        if (errorMessage.includes('CORS') || errorMessage.includes('cross-origin')) {
          const corsErrorMsg = "🌐 CORS issue detected. Enhanced headers have been applied.";
          addDebugInfo(corsErrorMsg, true);
          toast({
            title: "🔴 CORS Error",
            description: corsErrorMsg,
            variant: "destructive"
          });
          return;
        }

        if (errorMessage.includes('Empty request body')) {
          const emptyBodyErrorMsg = "📦 Empty request body detected. Check frontend payload generation.";
          addDebugInfo(emptyBodyErrorMsg, true);
          toast({
            title: "🔴 Payload Error",
            description: emptyBodyErrorMsg,
            variant: "destructive"
          });
          return;
        }

        // Generic error handling with request ID
        const requestId = response.data?.request_id || 'unknown';
        toast({
          title: "🔴 Flow Execution Failed",
          description: `Error: ${errorMessage} (Request ID: ${requestId})`,
          variant: "destructive"
        });
        return;
      }

      // Step 8: Enhanced success handling
      addDebugInfo(`✅ === ENHANCED SUCCESS ANALYSIS ===`);
      addDebugInfo(`🎉 Flow execution completed successfully!`);
      
      if (response.data) {
        addDebugInfo(`📊 Enhanced success data received`);
        addDebugInfo(`📋 Response keys: ${Object.keys(response.data).join(', ')}`);
        
        if (response.data.request_id) {
          addDebugInfo(`🔍 Success Request ID: ${response.data.request_id}`);
        }
        
        if (response.data.message) {
          addDebugInfo(`📝 Response message: ${response.data.message}`);
        }
      }

      toast({
        title: "🎉 Flow Executed Successfully!",
        description: `${flow.flow_name} has been executed with enhanced payload validation.`,
      });

      addDebugInfo(`🏁 === ENHANCED FLOW EXECUTION COMPLETED ===`);

    } catch (error) {
      addDebugInfo(`💥 === UNEXPECTED ERROR IN ENHANCED VERSION ===`, true);
      addDebugInfo(`🔍 Error: ${error.message}`, true);
      addDebugInfo(`🔍 Error type: ${error.constructor.name}`, true);
      
      toast({
        title: "🔴 Unexpected Error",
        description: `Enhanced version error: ${error.message}`,
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
