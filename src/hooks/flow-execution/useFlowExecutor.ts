
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FlowExecutionResult, FlowService } from '@/services/flowService';
import { useFlowAttempt } from './useFlowAttempt';
import type { UserFlow } from './types';

interface UseFlowExecutorProps {
  addLog: (message: string, isError?: boolean, performanceData?: any) => void;
}

export const useFlowExecutor = ({ addLog }: UseFlowExecutorProps) => {
  const [runningFlows, setRunningFlows] = useState<Set<string>>(new Set());
  const { session, user, isGoogleConnected, isTokenValid, getGoogleOAuthToken, forceTokenRefresh } = useAuth();

  const executeFlow = useCallback(async (flow: UserFlow): Promise<FlowExecutionResult | null> => {
    if (!user) {
      const errorMsg = "Authentication required to execute flows";
      addLog(errorMsg, true);
      return null;
    }

    if (!isGoogleConnected) {
      const errorMsg = "Google authentication required. Please connect your Google account.";
      addLog(errorMsg, true);
      return null;
    }

    const executeWithRetry = async (attemptNumber: number): Promise<FlowExecutionResult | null> => {
      if (attemptNumber === 1) {
        setRunningFlows(prev => new Set(prev).add(flow.id));
        addLog(`🚀 Starting flow execution: ${flow.flow_name} (attempt ${attemptNumber})`);
      } else {
        addLog(`🔄 Retrying flow execution: ${flow.flow_name} (attempt ${attemptNumber})`);
      }

      try {
        // Get current tokens if available
        let googleTokens = undefined;
        
        if (session && isTokenValid()) {
          const token = await getGoogleOAuthToken();
          if (token) {
            googleTokens = {
              access_token: session.access_token || token,
              refresh_token: session.refresh_token || '',
              provider_token: session.provider_token || token
            };
            addLog(`🔑 Using session tokens for flow execution`);
          } else {
            addLog(`⚠️ No valid session tokens available, will use saved tokens if available`);
          }
        } else {
          addLog(`⚠️ Session invalid or expired, will use saved tokens if available`);
        }

        // Create flow config
        const flowConfig = {
          senders: flow.email_filter, // Use email_filter as senders for now
          emailFilter: flow.email_filter,
          driveFolder: flow.drive_folder,
          fileTypes: flow.file_types,
          userId: flow.user_id,
          flowName: flow.flow_name,
          maxEmails: 10,
          enableDebugMode: true
        };

        // Execute flow - the Apps Script proxy will try to get saved tokens if session tokens aren't available
        const result = await FlowService.executeFlow(flow.id, flowConfig, googleTokens);

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
          
          // If it's the first attempt and we have token issues, try refreshing
          if (attemptNumber === 1 && (errorMsg.includes('token') || errorMsg.includes('auth'))) {
            addLog("🔄 Token issue detected, attempting to refresh session...", false);
            const refreshedSession = await forceTokenRefresh();
            if (refreshedSession) {
              return executeWithRetry(2);
            }
          }
          
          return result;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        addLog(`❌ Error executing flow "${flow.flow_name}": ${errorMsg}`, true);
        
        // Retry once on first attempt if it looks like a token issue
        if (attemptNumber === 1 && (errorMsg.includes('token') || errorMsg.includes('auth') || errorMsg.includes('401'))) {
          addLog("🔄 Authentication error detected, attempting to refresh session...", false);
          const refreshedSession = await forceTokenRefresh();
          if (refreshedSession) {
            return executeWithRetry(2);
          }
        }
        
        return { success: false, error: errorMsg };
      }
    };

    try {
      return await executeWithRetry(1);
    } finally {
      setRunningFlows(prev => {
        const newSet = new Set(prev);
        newSet.delete(flow.id);
        return newSet;
      });
    }
  }, [session, user, isGoogleConnected, addLog, isTokenValid, getGoogleOAuthToken, forceTokenRefresh]);

  return {
    runningFlows,
    executeFlow
  };
};
