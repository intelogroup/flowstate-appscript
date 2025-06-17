
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FlowExecutionResult } from '@/services/flowService';
import { useFlowAttempt } from './useFlowAttempt';
import type { UserFlow } from './types';

interface UseFlowExecutorProps {
  addLog: (message: string, isError?: boolean, performanceData?: any) => void;
}

export const useFlowExecutor = ({ addLog }: UseFlowExecutorProps) => {
  const [runningFlows, setRunningFlows] = useState<Set<string>>(new Set());
  const { session, isGoogleConnected, isTokenValid, getGoogleOAuthToken, forceTokenRefresh } = useAuth();
  const { executeFlowAttempt } = useFlowAttempt();

  const executeFlow = useCallback(async (flow: UserFlow): Promise<FlowExecutionResult | null> => {
    if (!session || !session.user) {
      const errorMsg = "Authentication required to execute flows";
      addLog(errorMsg, true);
      return null;
    }

    if (!isGoogleConnected) {
      const errorMsg = "Google authentication required. Please connect your Google account.";
      addLog(errorMsg, true);
      return null;
    }

    // Enhanced token validation with proactive refresh
    let validToken = getGoogleOAuthToken();
    if (!validToken || !isTokenValid()) {
      addLog("🔄 Token missing or expired, attempting refresh before execution...", false);
      
      const refreshedSession = await forceTokenRefresh();
      if (!refreshedSession) {
        addLog("❌ Token refresh failed, cannot execute flow", true);
        return null;
      }
      
      // Try to get token again after refresh
      validToken = getGoogleOAuthToken();
      if (!validToken) {
        addLog("❌ No valid token available after refresh", true);
        return null;
      }
    }

    const executeWithRetry = async (attemptNumber: number): Promise<FlowExecutionResult | null> => {
      if (attemptNumber === 1) {
        setRunningFlows(prev => new Set(prev).add(flow.id));
      }

      // Get fresh token for each attempt
      const currentToken = getGoogleOAuthToken();
      if (!currentToken) {
        addLog("❌ No valid token available for execution attempt", true);
        return null;
      }

      const result = await executeFlowAttempt({
        flow,
        attemptNumber,
        addLog,
        session,
        getGoogleOAuthToken: () => currentToken
      });

      // If result is null, it means we should retry
      if (result === null && attemptNumber === 1) {
        addLog("🔄 Retrying with fresh tokens...", false);
        
        // Force token refresh before retry
        const refreshedSession = await forceTokenRefresh();
        if (refreshedSession) {
          return executeWithRetry(2);
        } else {
          addLog("❌ Token refresh failed, cannot retry", true);
          return null;
        }
      }

      return result;
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
  }, [session, isGoogleConnected, addLog, isTokenValid, getGoogleOAuthToken, forceTokenRefresh, executeFlowAttempt]);

  return {
    runningFlows,
    executeFlow
  };
};
