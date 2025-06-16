
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useFlowManagement } from '@/hooks/useFlowManagement';
import { useFlowExecution } from '@/hooks/useFlowExecution';

// Import the existing components
import DebugPanel from './flow/DebugPanel';
import AuthStatusAlert from './flow/AuthStatusAlert';
import FlowCard from './flow/FlowCard';
import EmptyFlowsMessage from './flow/EmptyFlowsMessage';

const FlowManager = React.memo(() => {
  const { session } = useAuth();
  const { userFlows, isLoading, deleteFlow } = useFlowManagement();
  const { runningFlows, executionLogs, executeFlow, clearLogs } = useFlowExecution();

  // Check if user has Google authentication
  const hasGoogleAuth = !!(session?.provider_token || session?.access_token);

  const handleRunFlow = React.useCallback(async (flow: any) => {
    await executeFlow(flow);
  }, [executeFlow]);

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
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Flows</CardTitle>
          <CardDescription>Loading your Gmail to Drive flows...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="w-8 h-8 bg-blue-600 rounded-full animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Debug Information Panel */}
      <DebugPanel 
        debugInfo={executionLogs}
        onClear={clearLogs}
        onExport={exportLogs}
      />

      <Card>
        <CardHeader>
          <CardTitle>Your Flows</CardTitle>
          <CardDescription>Manage and execute your Gmail to Drive flows</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Authentication Status */}
          <AuthStatusAlert 
            hasGoogleAuth={hasGoogleAuth}
            authError={null}
          />

          {!userFlows || userFlows.length === 0 ? (
            <EmptyFlowsMessage hasGoogleAuth={hasGoogleAuth} />
          ) : (
            userFlows.map((flow) => (
              <FlowCard
                key={flow.id}
                flow={flow}
                isRunning={runningFlows.has(flow.id)}
                hasGoogleAuth={hasGoogleAuth}
                onRun={handleRunFlow}
                onDelete={handleDeleteFlow}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
});

FlowManager.displayName = 'FlowManager';

export default FlowManager;
