
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

  const buildFlowConfig = useCallback((flow: UserFlow) => {
    const config = {
      senders: flow.senders || flow.email_filter,
      driveFolder: flow.drive_folder,
      fileTypes: flow.file_types,
      userId: flow.user_id,
      flowName: flow.flow_name,
      maxEmails: 10,
      enableDebugMode: true
    };
    
    console.log('[FLOW EXECUTOR] 📋 Built flow config:', config);
    return config;
  }, []);

  const executeFlow = useCallback(async (flow: UserFlow) => {
    console.log('[FLOW EXECUTOR] 🚀 Starting flow execution for:', {
      flowId: flow.id,
      flowName: flow.flow_name,
      userId: flow.user_id,
      userExists: !!user
    });

    if (!user) {
      const errorMsg = "Authentication required to execute flows";
      console.error('[FLOW EXECUTOR] ❌ No user found:', errorMsg);
      addLog(errorMsg, true);
      throw new Error(errorMsg);
    }

    console.log('[FLOW EXECUTOR] ✅ User authenticated:', {
      userId: user.id,
      userEmail: user.email
    });

    const context = createExecutionContext(flow);
    setRunningFlows(prev => new Set(prev).add(flow.id));
    
    addLog(`🚀 Starting flow execution: ${flow.flow_name}`);

    try {
      const flowConfig = buildFlowConfig(flow);
      console.log('[FLOW EXECUTOR] 🔧 About to call FlowService.executeFlow with:', {
        flowId: flow.id,
        flowConfig
      });
      
      addLog(`🔑 Authenticating with Apps Script using shared secret for ${flow.flow_name}`);

      const result = await FlowService.executeFlow(flow.id, flowConfig);
      
      console.log('[FLOW EXECUTOR] 📥 Received result from FlowService:', {
        success: result?.success,
        hasError: !!result?.error,
        hasData: !!result?.data,
        result
      });

      if (result?.success) {
        const attachments = result.data?.attachments || 0;
        const emails = result.data?.processedEmails || 0;
        
        console.log('[FLOW EXECUTOR] ✅ Flow execution successful:', {
          flowName: flow.flow_name,
          attachments,
          emails,
          performanceMetrics: result.data?.performance_metrics
        });
        
        addLog(
          `✅ Flow "${flow.flow_name}" completed successfully! Processed ${attachments} attachments from ${emails} emails.`,
          false,
          result.data?.performance_metrics
        );
        return result;
      } else {
        const errorMsg = result?.error || 'Unknown error occurred during flow execution';
        console.error('[FLOW EXECUTOR] ❌ Flow execution failed:', {
          flowName: flow.flow_name,
          error: errorMsg,
          fullResult: result
        });
        
        addLog(`❌ Flow "${flow.flow_name}" failed: ${errorMsg}`, true);
        
        // Provide more specific error messages for common issues
        if (errorMsg.includes('Authentication failed')) {
          console.error('[FLOW EXECUTOR] 🔐 Authentication failure detected');
          throw new Error('Apps Script authentication failed. Please check your configuration.');
        } else if (errorMsg.includes('timeout')) {
          console.error('[FLOW EXECUTOR] ⏰ Timeout detected');
          throw new Error('Flow execution timed out. Please try again or check your Gmail settings.');
        } else if (errorMsg.includes('Gmail API')) {
          console.error('[FLOW EXECUTOR] 📧 Gmail API error detected');
          throw new Error('Gmail access error. Please reconnect your Google account.');
        } else if (errorMsg.includes('Drive')) {
          console.error('[FLOW EXECUTOR] 💾 Drive error detected');
          throw new Error('Google Drive access error. Please check folder permissions.');
        }
        
        throw new Error(errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[FLOW EXECUTOR] 💥 Exception during flow execution:', {
        flowName: flow.flow_name,
        error: errorMsg,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : 'No stack trace available'
      });
      
      addLog(`❌ Error executing flow "${flow.flow_name}": ${errorMsg}`, true);
      
      // Re-throw the error so it can be caught by the UI layer
      throw error;
    } finally {
      console.log('[FLOW EXECUTOR] 🏁 Flow execution completed, cleaning up:', {
        flowId: flow.id,
        flowName: flow.flow_name
      });
      
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
