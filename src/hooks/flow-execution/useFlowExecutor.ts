
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
      throw new Error(errorMsg);
    }

    const context = createExecutionContext(flow);
    setRunningFlows(prev => new Set(prev).add(flow.id));
    
    addLog(`🚀 Starting flow execution: ${flow.flow_name}`);

    try {
      const flowConfig = buildFlowConfig(flow);
      addLog(`🔑 Authenticating with Apps Script using shared secret for ${flow.flow_name}`);

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
        const errorMsg = result?.error || 'Unknown error occurred during flow execution';
        addLog(`❌ Flow "${flow.flow_name}" failed: ${errorMsg}`, true);
        
        // Provide more specific error messages for common issues
        if (errorMsg.includes('Authentication failed')) {
          throw new Error('Apps Script authentication failed. Please check your configuration.');
        } else if (errorMsg.includes('timeout')) {
          throw new Error('Flow execution timed out. Please try again or check your Gmail settings.');
        } else if (errorMsg.includes('Gmail API')) {
          throw new Error('Gmail access error. Please reconnect your Google account.');
        } else if (errorMsg.includes('Drive')) {
          throw new Error('Google Drive access error. Please check folder permissions.');
        }
        
        throw new Error(errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      addLog(`❌ Error executing flow "${flow.flow_name}": ${errorMsg}`, true);
      
      // Re-throw the error so it can be caught by the UI layer
      throw error;
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
