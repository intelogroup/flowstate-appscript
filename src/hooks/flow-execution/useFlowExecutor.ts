
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FlowExecutionResult } from '@/services/flowService';
import { useFlowExecution } from './useFlowExecution';
import type { UserFlow } from './types';

interface UseFlowExecutorProps {
  addLog: (message: string, isError?: boolean, performanceData?: any) => void;
}

export const useFlowExecutor = ({ addLog }: UseFlowExecutorProps) => {
  const [runningFlows, setRunningFlows] = useState<Set<string>>(new Set());
  const { session, isGoogleConnected, isTokenValid, getGoogleOAuthToken } = useAuth();
  const { executeFlowAttempt } = useFlowExecution();

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

    // Enhanced token validation before execution
    if (!isTokenValid()) {
      addLog("🔄 Token appears expired, attempting refresh before execution...", false);
      // Token refresh will be handled in the retry logic
    }

    const executeWithRetry = async (attemptNumber: number): Promise<FlowExecutionResult | null> => {
      if (attemptNumber === 1) {
        setRunningFlows(prev => new Set(prev).add(flow.id));
      }

      const result = await executeFlowAttempt({
        flow,
        attemptNumber,
        addLog,
        session,
        getGoogleOAuthToken
      });

      // If result is null, it means we should retry
      if (result === null && attemptNumber === 1) {
        return executeWithRetry(2);
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
  }, [session, isGoogleConnected, addLog, isTokenValid, getGoogleOAuthToken, executeFlowAttempt]);

  return {
    runningFlows,
    executeFlow
  };
};
