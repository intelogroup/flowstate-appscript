
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
import FlowCard from './flow/FlowCard';

const FlowManager = React.memo(() => {
  const { session } = useAuth();
  const { userFlows, isLoading, deleteFlow } = useFlowManagement();
  const { runningFlows, executionLogs, executeFlow, clearLogs, checkConnectivity } = useFlowExecution();
  const { startCooldown, getCooldownInfo } = useFlowCooldown();

  // Check if user has Google authentication
  const hasGoogleAuth = !!(session?.provider_token || session?.access_token);

  const handleRunFlow = React.useCallback(async (flow: any) => {
    const result = await executeFlow(flow);
    if (result && result.success) {
      startCooldown(flow.id);
    }
  }, [executeFlow, startCooldown]);

  const handleDeleteFlow = React.useCallback(async (flowId: string) => {
    await deleteFlow(flowId);
  }, [deleteFlow]);

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
      {/* Performance Monitor */}
      <PerformanceMonitor 
        onHealthCheck={checkConnectivity}
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
          <AuthStatusAlert 
            hasGoogleAuth={hasGoogleAuth}
            authError={null}
          />

          {!userFlows || userFlows.length === 0 ? (
            <EmptyFlowsMessage hasGoogleAuth={hasGoogleAuth} />
          ) : (
            <div className="space-y-4">
              {userFlows.map((flow) => {
                const isRunning = runningFlows.has(flow.id);
                const cooldownInfo = getCooldownInfo(flow.id);
                
                return (
                  <FlowCard
                    key={flow.id}
                    flow={flow}
                    isRunning={isRunning}
                    hasGoogleAuth={hasGoogleAuth}
                    isOnCooldown={cooldownInfo.isOnCooldown}
                    cooldownDisplay={cooldownInfo.displayTime}
                    onRun={handleRunFlow}
                    onDelete={handleDeleteFlow}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

FlowManager.displayName = 'FlowManager';

export default FlowManager;
