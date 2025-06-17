
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useFlowManagement } from '@/hooks/useFlowManagement';
import { useFlowExecution } from '@/hooks/useFlowExecution';
import { useFlowCooldown } from '@/hooks/useFlowCooldown';

// Import the refactored components
import DebugPanel from './flow/DebugPanel';
import AuthStatusAlert from './flow/AuthStatusAlert';
import EmptyFlowsMessage from './flow/EmptyFlowsMessage';
import FlowManagerHeader from './flow/FlowManagerHeader';
import LoadingState from './flow/LoadingState';
import PerformanceMonitor from './flow/PerformanceMonitor';
import FlowList from './flow/FlowList';
import TokenDebugPanel from './flow/TokenDebugPanel';

const FlowManager = React.memo(() => {
  const { session, isGoogleConnected } = useAuth();
  const { userFlows, isLoading, deleteFlow } = useFlowManagement();
  const { runningFlows, executionLogs, executeFlow, clearLogs, checkConnectivity } = useFlowExecution();
  const { startCooldown, getCooldownInfo } = useFlowCooldown();

  const handleRunFlow = React.useCallback(async (flow: any) => {
    const result = await executeFlow(flow);
    if (result && result.success) {
      startCooldown(flow.id);
    }
  }, [executeFlow, startCooldown]);

  const handleDeleteFlow = React.useCallback(async (flowId: string) => {
    await deleteFlow(flowId);
  }, [deleteFlow]);

  const handleConnectivityCheck = React.useCallback(async (): Promise<boolean> => {
    return await checkConnectivity();
  }, [checkConnectivity]);

  const exportLogs = React.useCallback(() => {
    const logsText = executionLogs.join('\n');
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowstate-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [executionLogs]);

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      {/* Token Debug Panel - Show when user is authenticated */}
      {session && <TokenDebugPanel />}

      {/* Performance Monitor */}
      <PerformanceMonitor 
        onHealthCheck={handleConnectivityCheck}
        executionLogs={executionLogs}
      />

      {/* Debug Information Panel */}
      <DebugPanel 
        debugInfo={executionLogs}
        onClear={clearLogs}
        onExport={exportLogs}
      />

      <Card>
        <FlowManagerHeader />
        <CardContent className="space-y-4">
          {/* Authentication Status */}
          <AuthStatusAlert />

          {!userFlows || userFlows.length === 0 ? (
            <EmptyFlowsMessage hasGoogleAuth={isGoogleConnected} />
          ) : (
            <FlowList
              flows={userFlows}
              runningFlows={runningFlows}
              hasGoogleAuth={isGoogleConnected}
              getCooldownInfo={getCooldownInfo}
              onRun={handleRunFlow}
              onDelete={handleDeleteFlow}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
});

FlowManager.displayName = 'FlowManager';

export default FlowManager;
