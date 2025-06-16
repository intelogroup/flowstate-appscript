
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

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pa3Jvc25ya2d4bGJic2pkYmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjMwMzcsImV4cCI6MjA2NTU5OTAzN30.mrTrjtKDsS99v87pr64Gt1Rib6JU5V9gIfdly4bl9J0";

export const useFlowOperations = (
  addDebugInfo: (message: string, isError?: boolean) => void,
  logSessionDetails: () => void
) => {
  const [runningFlows, setRunningFlows] = useState<Set<string>>(new Set());
  const [authError, setAuthError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, session } = useAuth();

  // Edge Function test function (proper proxy approach)
  const testEdgeFunction = useCallback(async (flowId: string) => {
    addDebugInfo('[EDGE FUNCTION] Starting Edge Function test via apps-script-proxy...');
    
    try {
      // Get the flow configuration from database
      addDebugInfo('[EDGE FUNCTION] Fetching flow configuration from database...');
      const { data: flow, error: flowError } = await supabase
        .from('user_configurations')
        .select('*')
        .eq('id', flowId)
        .eq('user_id', user?.id)
        .single();

      if (flowError) {
        addDebugInfo(`[EDGE FUNCTION] Database error: ${flowError.message}`, true);
        throw new Error(`Database error: ${flowError.message}`);
      }

      if (!flow) {
        addDebugInfo('[EDGE FUNCTION] Flow not found in database', true);
        throw new Error('Flow not found');
      }

      addDebugInfo(`[EDGE FUNCTION] Flow found: ${flow.flow_name}`);
      addDebugInfo(`[EDGE FUNCTION] Email filter: ${flow.email_filter}`);
      addDebugInfo(`[EDGE FUNCTION] Drive folder: ${flow.drive_folder}`);

      // Create the payload for the Edge Function
      const payload = {
        action: "run_flow", // Edge Function expects this action
        flowId: flow.id,
        userConfig: {
          emailFilter: flow.email_filter,
          driveFolder: flow.drive_folder,
          fileTypes: flow.file_types || [],
          userId: flow.user_id,
          flowName: flow.flow_name,
          maxEmails: 5 // Reduced for faster testing
        },
        googleTokens: {
          access_token: session?.access_token,
          refresh_token: session?.refresh_token,
          provider_token: session?.provider_token
        }
      };

      addDebugInfo('[EDGE FUNCTION] Payload created for Edge Function:');
      addDebugInfo(`- action: ${payload.action}`);
      addDebugInfo(`- flowId: ${payload.flowId}`);
      addDebugInfo(`- emailFilter: ${payload.userConfig.emailFilter}`);
      addDebugInfo(`- driveFolder: ${payload.userConfig.driveFolder}`);
      addDebugInfo(`- maxEmails: ${payload.userConfig.maxEmails}`);
      addDebugInfo(`- hasAccessToken: ${!!payload.googleTokens.access_token}`);

      const payloadString = JSON.stringify(payload);
      addDebugInfo(`[EDGE FUNCTION] Payload size: ${payloadString.length} characters`);

      // Call Edge Function using proper Supabase URL
      const edgeFunctionUrl = 'https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/apps-script-proxy';
      
      addDebugInfo('[EDGE FUNCTION] Calling Edge Function...');
      addDebugInfo(`[EDGE FUNCTION] URL: ${edgeFunctionUrl}`);
      
      const startTime = Date.now();
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: payloadString
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      addDebugInfo(`[EDGE FUNCTION] Response received in ${duration}ms`);
      addDebugInfo(`[EDGE FUNCTION] Status: ${response.status}`);
      addDebugInfo(`[EDGE FUNCTION] Status Text: ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        addDebugInfo(`[EDGE FUNCTION] ❌ Error response body: ${errorText.substring(0, 300)}`, true);
        
        if (response.status === 504) {
          addDebugInfo('[EDGE FUNCTION] ❌ Gateway timeout - Apps Script took too long', true);
          throw new Error('Gateway timeout - Apps Script processing took too long (>30s)');
        }
        
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      addDebugInfo('[EDGE FUNCTION] ✅ SUCCESS!');
      addDebugInfo(`[EDGE FUNCTION] Response structure: ${Object.keys(result).join(', ')}`);
      
      // Handle different response formats
      if (result.success && result.apps_script_response) {
        const appsScriptData = result.apps_script_response;
        addDebugInfo(`[EDGE FUNCTION] Apps Script Status: ${appsScriptData.status}`);
        addDebugInfo(`[EDGE FUNCTION] Apps Script Message: ${appsScriptData.message}`);
        
        if (appsScriptData.data) {
          addDebugInfo('[EDGE FUNCTION] Apps Script Data:');
          addDebugInfo(`- Processed: ${appsScriptData.data.processed}`);
          addDebugInfo(`- Attachments: ${appsScriptData.data.attachments}`);
          addDebugInfo(`- Files: ${appsScriptData.data.files?.length || 0}`);
          addDebugInfo(`- Errors: ${appsScriptData.data.errors?.length || 0}`);
          
          if (appsScriptData.data.attachments > 0) {
            addDebugInfo(`[EDGE FUNCTION] 🎉 Successfully processed ${appsScriptData.data.attachments} attachments!`);
            
            if (appsScriptData.data.files && appsScriptData.data.files.length > 0) {
              addDebugInfo('[EDGE FUNCTION] Saved files:');
              appsScriptData.data.files.forEach((file: any, index: number) => {
                addDebugInfo(`[EDGE FUNCTION] ${index + 1}. ${file.name} (${file.size} bytes)`);
                addDebugInfo(`[EDGE FUNCTION]    Drive URL: ${file.url}`);
              });
              
              toast({
                title: "🎉 Edge Function Success!",
                description: `Processed ${appsScriptData.data.attachments} attachments via Edge Function proxy`,
              });
            }
          } else {
            addDebugInfo('[EDGE FUNCTION] ⚠️ No attachments were processed');
            
            toast({
              title: "⚠️ No Attachments Found",
              description: "Edge Function worked, but no matching emails with attachments were found.",
            });
          }
        }
        
        return appsScriptData;
      } else {
        addDebugInfo(`[EDGE FUNCTION] Unexpected response format: ${JSON.stringify(result)}`, true);
        throw new Error('Unexpected response format from Edge Function');
      }

    } catch (error) {
      addDebugInfo(`[EDGE FUNCTION] ❌ Failed: ${error.message}`, true);
      
      toast({
        title: "🔴 Edge Function Failed",
        description: `Error: ${error.message}`,
        variant: "destructive"
      });
      
      throw error;
    }
  }, [addDebugInfo, toast, user?.id, session]);

  const runFlow = useCallback(async (flow: UserFlow) => {
    addDebugInfo(`🚀 === STARTING EDGE FUNCTION TEST FOR FLOW: ${flow.flow_name} ===`);
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

      addDebugInfo("✅ Session validated");
      addDebugInfo(`👤 User ID: ${session.user?.id}`);
      addDebugInfo(`📧 User Email: ${session.user?.email}`);

      // Step 2: Run Edge Function test
      addDebugInfo("📋 Step 2: Running Edge Function test");
      const result = await testEdgeFunction(flow.id);

      addDebugInfo(`✅ === EDGE FUNCTION TEST COMPLETED SUCCESSFULLY ===`);
      addDebugInfo(`🎉 Flow execution completed!`);

      if (result && result.data && result.data.attachments > 0) {
        toast({
          title: "🎉 Flow Executed Successfully!",
          description: `${flow.flow_name} processed ${result.data.attachments} attachments successfully.`,
        });
      } else {
        toast({
          title: "✅ Flow Test Completed",
          description: `${flow.flow_name} test completed - no attachments found to process.`,
        });
      }

      addDebugInfo(`🏁 === EDGE FUNCTION FLOW EXECUTION COMPLETED ===`);

    } catch (error) {
      addDebugInfo(`💥 === EDGE FUNCTION ERROR ===`, true);
      addDebugInfo(`🔍 Error: ${error.message}`, true);
      addDebugInfo(`🔍 Error type: ${error.constructor.name}`, true);
      
      toast({
        title: "🔴 Edge Function Error",
        description: `Edge Function error: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setRunningFlows(prev => {
        const newSet = new Set(prev);
        newSet.delete(flow.id);
        return newSet;
      });
    }
  }, [session, addDebugInfo, toast, testEdgeFunction]);

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
