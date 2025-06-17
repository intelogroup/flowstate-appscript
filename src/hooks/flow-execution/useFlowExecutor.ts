
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FlowService } from '@/services/flowService';
import type { UserFlow, FlowExecutorConfig, ExecutionContext } from './types';

interface UseFlowExecutorProps {
  addLog: (message: string, isError?: boolean, performanceData?: any) => void;
}

const DEFAULT_CONFIG: FlowExecutorConfig = {
  maxRetries: 2,
  retryDelay: 1000,
  timeoutDuration: 30000
};

export const useFlowExecutor = ({ addLog }: UseFlowExecutorProps) => {
  const [runningFlows, setRunningFlows] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const createExecutionContext = useCallback((flow: UserFlow): ExecutionContext => ({
    flow,
    attemptNumber: 1,
    startTime: Date.now(),
    config: DEFAULT_CONFIG
  }), []);

  const buildFlowConfig = useCallback((flow: UserFlow) => ({
    senders: flow.senders || flow.email_filter,
    driveFolder: flow.drive_folder,
    fileTypes: flow.file_types,
    userId: flow.user_id,
    flowName: flow.flow_name,
    maxEmails: 10,
    enableDebugMode: true
  }), []);

  const executeFlow = useCallback(async (flow: UserFlow) => {
    if (!user) {
      const errorMsg = "Authentication required to execute flows";
      addLog(errorMsg, true);
      return null;
    }

    const context = createExecutionContext(flow);
    setRunningFlows(prev => new Set(prev).add(flow.id));
    
    addLog(`🚀 Starting flow execution: ${flow.flow_name}`);

    try {
      const flowConfig = buildFlowConfig(flow);
      addLog(`🔑 Using simplified authentication for ${flow.flow_name}`);

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
  }, [user, addLog, createExecutionContext, buildFlowConfig]);

  return {
    runningFlows,
    executeFlow
  };
};
