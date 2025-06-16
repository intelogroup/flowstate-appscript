
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { FlowService, FlowConfig, FlowExecutionResult } from '@/services/flowService';

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

export const useFlowExecution = () => {
  const [runningFlows, setRunningFlows] = useState<Set<string>>(new Set());
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const { toast } = useToast();
  const { user, session } = useAuth();

  const addLog = useCallback((message: string, isError: boolean = false) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    
    console.log(`[FLOW EXECUTION] ${logMessage}`);
    setExecutionLogs(prev => [...prev.slice(-19), logMessage]);
    
    toast({
      title: isError ? "🔴 Error" : "🔍 Flow Log",
      description: message,
      variant: isError ? "destructive" : "default"
    });
  }, [toast]);

  const executeFlow = useCallback(async (flow: UserFlow): Promise<FlowExecutionResult | null> => {
    if (!session) {
      const errorMsg = "Authentication required to execute flows";
      addLog(errorMsg, true);
      toast({
        title: "🔴 Authentication Required",
        description: errorMsg,
        variant: "destructive"
      });
      return null;
    }

    addLog(`🚀 Starting execution for flow: ${flow.flow_name}`);
    setRunningFlows(prev => new Set(prev).add(flow.id));

    try {
      const userConfig: FlowConfig = {
        emailFilter: flow.email_filter,
        driveFolder: flow.drive_folder,
        fileTypes: flow.file_types || [],
        userId: flow.id,
        flowName: flow.flow_name,
        maxEmails: 5
      };

      const googleTokens = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        provider_token: session.provider_token
      };

      addLog("📋 Sending request to Edge Function...");
      const result = await FlowService.executeFlow(flow.id, userConfig, googleTokens);

      addLog("✅ Flow execution completed successfully");
      
      if (result.data && result.data.attachments > 0) {
        addLog(`🎉 Processed ${result.data.attachments} attachments successfully`);
        toast({
          title: "🎉 Flow Executed Successfully!",
          description: `${flow.flow_name} processed ${result.data.attachments} attachments.`,
        });
      } else {
        addLog("⚠️ No attachments were found to process");
        toast({
          title: "✅ Flow Completed",
          description: `${flow.flow_name} completed - no attachments found.`,
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addLog(`❌ Flow execution failed: ${errorMessage}`, true);
      
      toast({
        title: "🔴 Flow Execution Failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      return null;
    } finally {
      setRunningFlows(prev => {
        const newSet = new Set(prev);
        newSet.delete(flow.id);
        return newSet;
      });
    }
  }, [session, addLog, toast]);

  const clearLogs = useCallback(() => {
    setExecutionLogs([]);
    toast({
      title: "🧹 Logs Cleared",
      description: "Execution logs have been cleared.",
    });
  }, [toast]);

  return {
    runningFlows,
    executionLogs,
    executeFlow,
    clearLogs,
    addLog
  };
};
