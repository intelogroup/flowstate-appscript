
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

  // Direct Apps Script test function
  const testDirectAppsScript = useCallback(async (flowId: string) => {
    addDebugInfo('[DIRECT TEST] Starting direct Apps Script test...');
    
    try {
      // Get the flow configuration from database using correct table name
      addDebugInfo('[DIRECT TEST] Fetching flow configuration from database...');
      const { data: flow, error: flowError } = await supabase
        .from('user_configurations')
        .select('*')
        .eq('id', flowId)
        .eq('user_id', user?.id)
        .single();

      if (flowError) {
        addDebugInfo(`[DIRECT TEST] Database error: ${flowError.message}`, true);
        throw new Error(`Database error: ${flowError.message}`);
      }

      if (!flow) {
        addDebugInfo('[DIRECT TEST] Flow not found in database', true);
        throw new Error('Flow not found');
      }

      addDebugInfo(`[DIRECT TEST] Flow found: ${flow.flow_name}`);
      addDebugInfo(`[DIRECT TEST] Email filter: ${flow.email_filter}`);
      addDebugInfo(`[DIRECT TEST] Drive folder: ${flow.drive_folder}`);

      // Create the EXACT payload that Apps Script expects
      const payload = {
        auth_token: "deff633d-63d3-4c4f-947b-61a7842bab29", // Apps Script secret
        action: "process_gmail_flow",
        userConfig: {
          emailFilter: flow.email_filter,
          driveFolder: flow.drive_folder,
          fileTypes: flow.file_types || [],
          userId: flow.user_id,
          flowName: flow.flow_name,
          maxEmails: 5 // Reduced for faster testing
        },
        googleTokens: null
      };

      addDebugInfo('[DIRECT TEST] Payload created for Apps Script:');
      addDebugInfo(`- auth_token present: ${!!payload.auth_token}`);
      addDebugInfo(`- action: ${payload.action}`);
      addDebugInfo(`- emailFilter: ${payload.userConfig.emailFilter}`);
      addDebugInfo(`- driveFolder: ${payload.userConfig.driveFolder}`);
      addDebugInfo(`- maxEmails: ${payload.userConfig.maxEmails}`);

      const payloadString = JSON.stringify(payload);
      addDebugInfo(`[DIRECT TEST] Payload size: ${payloadString.length} characters`);
      addDebugInfo(`[DIRECT TEST] Payload preview: ${payloadString.substring(0, 200)}...`);

      // Call Apps Script directly (bypass Edge Function completely)
      const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbxqRLyD5famZnHY3W-sTnsYEjyxQ6Q02gcKSQba2Bw6tqTTpimZ2up0WlPKQYII-dvA/exec';
      
      addDebugInfo('[DIRECT TEST] Calling Apps Script directly...');
      addDebugInfo(`[DIRECT TEST] URL: ${appsScriptUrl}`);
      
      const startTime = Date.now();
      
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: payloadString,
        mode: 'cors'
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      addDebugInfo(`[DIRECT TEST] Response received in ${duration}ms`);
      addDebugInfo(`[DIRECT TEST] Status: ${response.status}`);
      addDebugInfo(`[DIRECT TEST] Status Text: ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        addDebugInfo(`[DIRECT TEST] ❌ Error response body: ${errorText.substring(0, 200)}`, true);
        
        // Check if it's HTML (login page)
        if (errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')) {
          addDebugInfo('[DIRECT TEST] ❌ Received HTML login page - deployment settings wrong', true);
          throw new Error('Apps Script deployment requires authentication. Check deployment settings.');
        }
        
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      addDebugInfo('[DIRECT TEST] ✅ SUCCESS!');
      addDebugInfo(`[DIRECT TEST] Response structure: ${Object.keys(result).join(', ')}`);
      addDebugInfo(`[DIRECT TEST] Status: ${result.status}`);
      addDebugInfo(`[DIRECT TEST] Message: ${result.message}`);
      
      if (result.data) {
        addDebugInfo('[DIRECT TEST] Data received:');
        addDebugInfo(`- Processed: ${result.data.processed}`);
        addDebugInfo(`- Attachments: ${result.data.attachments}`);
        addDebugInfo(`- Files: ${result.data.files?.length || 0}`);
        addDebugInfo(`- Errors: ${result.data.errors?.length || 0}`);
        
        if (result.data.attachments > 0) {
          addDebugInfo(`[DIRECT TEST] 🎉 Successfully processed ${result.data.attachments} attachments!`);
          
          if (result.data.files && result.data.files.length > 0) {
            addDebugInfo('[DIRECT TEST] Saved files:');
            result.data.files.forEach((file: any, index: number) => {
              addDebugInfo(`[DIRECT TEST] ${index + 1}. ${file.name} (${file.size} bytes)`);
              addDebugInfo(`[DIRECT TEST]    Drive URL: ${file.url}`);
            });
            
            toast({
              title: "🎉 Direct Test Success!",
              description: `Processed ${result.data.attachments} attachments and saved them to Drive folder "${payload.userConfig.driveFolder}"`,
            });
          }
        } else {
          addDebugInfo('[DIRECT TEST] ⚠️ No attachments were processed');
          addDebugInfo('[DIRECT TEST] This might mean no matching emails were found');
          
          toast({
            title: "⚠️ No Attachments Found",
            description: "The direct test worked, but no matching emails with attachments were found.",
          });
        }
      }
      
      return result;

    } catch (error) {
      addDebugInfo(`[DIRECT TEST] ❌ Failed: ${error.message}`, true);
      
      toast({
        title: "🔴 Direct Test Failed",
        description: `Error: ${error.message}`,
        variant: "destructive"
      });
      
      throw error;
    }
  }, [addDebugInfo, toast, user?.id]);

  const runFlow = useCallback(async (flow: UserFlow) => {
    addDebugInfo(`🚀 === STARTING DIRECT TEST FOR FLOW: ${flow.flow_name} ===`);
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

      // Step 2: Run direct Apps Script test
      addDebugInfo("📋 Step 2: Running direct Apps Script test");
      const result = await testDirectAppsScript(flow.id);

      addDebugInfo(`✅ === DIRECT TEST COMPLETED SUCCESSFULLY ===`);
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

      addDebugInfo(`🏁 === DIRECT TEST FLOW EXECUTION COMPLETED ===`);

    } catch (error) {
      addDebugInfo(`💥 === DIRECT TEST ERROR ===`, true);
      addDebugInfo(`🔍 Error: ${error.message}`, true);
      addDebugInfo(`🔍 Error type: ${error.constructor.name}`, true);
      
      toast({
        title: "🔴 Direct Test Error",
        description: `Direct test error: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setRunningFlows(prev => {
        const newSet = new Set(prev);
        newSet.delete(flow.id);
        return newSet;
      });
    }
  }, [session, addDebugInfo, toast, testDirectAppsScript]);

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
