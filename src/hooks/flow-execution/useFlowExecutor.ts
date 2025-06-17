
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FlowExecutionResult, FlowService } from '@/services/flowService';
import type { UserFlow } from './types';

interface UseFlowExecutorProps {
  addLog: (message: string, isError?: boolean, performanceData?: any) => void;
}

export const useFlowExecutor = ({ addLog }: UseFlowExecutorProps) => {
  const [runningFlows, setRunningFlows] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const executeFlow = useCallback(async (flow: UserFlow): Promise<FlowExecutionResult | null> => {
    if (!user) {
      const errorMsg = "Authentication required to execute flows";
      addLog(errorMsg, true);
      return null;
    }

    setRunningFlows(prev => new Set(prev).add(flow.id));
    addLog(`🚀 Starting flow execution: ${flow.flow_name} (simplified auth)`);

    try {
      // Create flow config with simplified structure
      const flowConfig = {
        senders: flow.email_filter, // Use email_filter as senders
        driveFolder: flow.drive_folder,
        fileTypes: flow.file_types,
        userId: flow.user_id,
        flowName: flow.flow_name,
        maxEmails: 10,
        enableDebugMode: true
      };

      addLog(`🔑 Using shared secret authentication for ${flow.flow_name}`);

      // Execute flow with simplified authentication
      const result = await FlowService.executeFlow(flow.id, flowConfig);

      if (result?.success) {
        const attachments = result.data?.attachments || 0;
        const emails = result.data?.processedEmails || 0;
        
        addLog(
          `✅ Flow "${flow.flow_name}" completed successfully! Processed ${attachments} attachments from ${emails} emails.`,
          false,
          result.data?.performance_metrics
        );
        return result;
      } else {
        const errorMsg = result?.error || 'Unknown error';
        addLog(`❌ Flow "${flow.flow_name}" failed: ${errorMsg}`, true);
        return result;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Error executing flow "${flow.flow_name}": ${errorMsg}`, true);
      return { success: false, error: errorMsg };
    } finally {
      setRunningFlows(prev => {
        const newSet = new Set(prev);
        newSet.delete(flow.id);
        return newSet;
      });
    }
  }, [user, addLog]);

  return {
    runningFlows,
    executeFlow
  };
};
