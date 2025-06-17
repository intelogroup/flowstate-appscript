
import { useFlowLogger } from './flow-execution/useFlowLogger';
import { useFlowExecutor } from './flow-execution/useFlowExecutor';
import type { FlowExecutionHookReturn } from './flow-execution/types';

export const useFlowExecution = (): FlowExecutionHookReturn => {
  const { executionLogs, addLog, clearLogs } = useFlowLogger();
  const { runningFlows, executeFlow } = useFlowExecutor({ addLog });

  return {
    runningFlows,
    executionLogs,
    executeFlow,
    clearLogs,
    addLog,
    checkConnectivity: async () => true // Simplified connectivity check
  };
};
