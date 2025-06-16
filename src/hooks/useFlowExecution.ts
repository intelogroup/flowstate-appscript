
import { useFlowLogger } from './flow-execution/useFlowLogger';
import { useFlowExecutor } from './flow-execution/useFlowExecutor';
import { useConnectivityChecker } from './flow-execution/useConnectivityChecker';
import type { FlowExecutionHookReturn } from './flow-execution/types';

export const useFlowExecution = (): FlowExecutionHookReturn => {
  const { executionLogs, addLog, clearLogs } = useFlowLogger();
  const { runningFlows, executeFlow } = useFlowExecutor({ addLog });
  const { checkConnectivity } = useConnectivityChecker({ addLog });

  return {
    runningFlows,
    executionLogs,
    executeFlow,
    clearLogs,
    addLog,
    checkConnectivity
  };
};
