
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

      // Step 4: Direct fetch payload preparation
      addDebugInfo("📋 Step 4: Direct fetch payload preparation");
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
          client_version: '9.0-direct-fetch-fix',
          request_source: 'frontend-flowmanager-direct-fetch',
          network_debug: true,
          retry_enabled: true
        }
      };

      const payloadString = JSON.stringify(requestPayload);
      addDebugInfo(`📦 Payload prepared: ${payloadString.length} characters`);
      addDebugInfo(`🎯 Target flow: ${flow.flow_name} (ID: ${flow.id})`);
      addDebugInfo(`📄 Payload preview: ${payloadString.substring(0, 100)}...`);

      // Step 5: Direct fetch execution (bypassing supabase.functions.invoke)
      addDebugInfo("📋 Step 5: Direct fetch execution");
      
      const executeDirectFetch = async () => {
        addDebugInfo("🌐 Using direct fetch to bypass invoke() issues...");
        
        const fetchStartTime = performance.now();
        
        const response = await fetch('https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/apps-script-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pa3Jvc25ya2d4bGJic2pkYmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjMwMzcsImV4cCI6MjA2NTU5OTAzN30.mrTrjtKDsS99v87pr64Gt1Rib6JU5V9gIfdly4bl9J0',
            'x-debug-source': 'flowmanager-direct-fetch-v9',
            'x-user-agent': 'FlowState-WebApp/9.0-direct-fetch-fix'
          },
          body: payloadString
        });
        
        const fetchEndTime = performance.now();
        addDebugInfo(`⏱️ Direct fetch completed in ${Math.round(fetchEndTime - fetchStartTime)}ms`);
        addDebugInfo(`📊 Response status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          addDebugInfo(`❌ HTTP Error: ${response.status}`, true);
          addDebugInfo(`❌ Error body: ${errorText.substring(0, 200)}`, true);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        addDebugInfo(`✅ Direct fetch successful`);
        
        if (result.request_id) {
          addDebugInfo(`🔍 Request ID: ${result.request_id}`);
        }
        
        return result;
      };

      let response;
      try {
        response = await retryWithBackoff(executeDirectFetch, 3, 1000);
        
      } catch (directFetchError) {
        addDebugInfo(`💥 Direct fetch failed:`, true);
        addDebugInfo(`- Error: ${directFetchError.message}`, true);
        
        toast({
          title: "🔴 Network Connection Error",
          description: `Direct fetch failed: ${directFetchError.message}`,
          variant: "destructive"
        });
        return;
      }

      // Step 6: Enhanced success handling
      addDebugInfo(`✅ === DIRECT FETCH SUCCESS ===`);
      addDebugInfo(`🎉 Flow execution completed successfully!`);
      
      if (response) {
        addDebugInfo(`📊 Response data received`);
        addDebugInfo(`📋 Response keys: ${Object.keys(response).join(', ')}`);
        
        if (response.request_id) {
          addDebugInfo(`🔍 Request ID: ${response.request_id}`);
        }
        
        if (response.message) {
          addDebugInfo(`📝 Response message: ${response.message}`);
        }
      }

      toast({
        title: "🎉 Flow Executed Successfully!",
        description: `${flow.flow_name} has been executed using direct fetch method.`,
      });

      addDebugInfo(`🏁 === DIRECT FETCH FLOW EXECUTION COMPLETED ===`);

    } catch (error) {
      addDebugInfo(`💥 === UNEXPECTED ERROR IN DIRECT FETCH VERSION ===`, true);
      addDebugInfo(`🔍 Error: ${error.message}`, true);
      addDebugInfo(`🔍 Error type: ${error.constructor.name}`, true);
      
      toast({
        title: "🔴 Unexpected Error",
        description: `Direct fetch error: ${error.message}`,
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
