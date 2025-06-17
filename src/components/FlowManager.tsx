
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Play, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFlowManagement } from '@/hooks/useFlowManagement';
import { useFlowExecutor } from '@/hooks/flow-execution/useFlowExecutor';
import FlowCard from '@/components/flow/FlowCard';
import AuthStatusAlert from '@/components/flow/AuthStatusAlert';
import DebugPanel from '@/components/flow/DebugPanel';
import TokenDebugPanel from '@/components/flow/TokenDebugPanel';
import PerformanceMonitor from '@/components/flow/PerformanceMonitor';
import SavedTokensPanel from '@/components/flow/SavedTokensPanel';

interface Log {
  id: string;
  message: string;
  timestamp: Date;
  isError?: boolean;
  performanceData?: any;
}

const FlowManager = () => {
  const { user, isGoogleConnected } = useAuth();
  const { userFlows, isLoading, refetch } = useFlowManagement();
  const [logs, setLogs] = useState<Log[]>([]);
  const [activeTab, setActiveTab] = useState('flows');
  const [performanceData, setPerformanceData] = useState<any[]>([]);

  const addLog = (message: string, isError = false, performanceData?: any) => {
    setLogs(prev => [
      {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        message,
        timestamp: new Date(),
        isError,
        performanceData
      },
      ...prev.slice(0, 99) // Keep only the last 100 logs
    ]);

    if (performanceData) {
      setPerformanceData(prev => [...prev, { ...performanceData, timestamp: new Date() }].slice(-20));
    }
  };

  const { runningFlows, executeFlow } = useFlowExecutor({ addLog });

  const handleExecuteFlow = async (flowId: string) => {
    if (!user || !isGoogleConnected) {
      addLog('Authentication required to execute flows', true);
      return;
    }

    const flow = userFlows?.find(f => f.id === flowId);
    if (!flow) {
      addLog(`Flow with ID ${flowId} not found`, true);
      return;
    }

    addLog(`🚀 Starting flow execution: ${flow.flow_name}`);
    
    try {
      const result = await executeFlow({
        id: flow.id,
        flow_name: flow.flow_name,
        email_filter: flow.email_filter,
        drive_folder: flow.drive_folder,
        file_types: flow.file_types,
        userId: flow.user_id
      });

      if (result?.success) {
        const attachments = result.data?.attachments || 0;
        const emails = result.data?.processedEmails || 0;
        
        addLog(
          `✅ Flow "${flow.flow_name}" completed successfully! Processed ${attachments} attachments from ${emails} emails.`,
          false,
          result.data?.performance_metrics
        );
      } else {
        addLog(`❌ Flow "${flow.flow_name}" failed: ${result?.error || 'Unknown error'}`, true);
      }
    } catch (error) {
      addLog(`❌ Error executing flow "${flow.flow_name}": ${error instanceof Error ? error.message : 'Unknown error'}`, true);
    }
  };

  useEffect(() => {
    if (user && isGoogleConnected) {
      addLog('🔐 Authenticated with Google - ready to execute flows');
    }
  }, [user, isGoogleConnected]);

  return (
    <div className="space-y-6">
      <AuthStatusAlert />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="flows">My Flows</TabsTrigger>
            <TabsTrigger value="create">Create Flow</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <TabsContent value="flows" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Gmail Attachment Flows</CardTitle>
              <CardDescription>
                Configure automated workflows to save Gmail attachments to Google Drive
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-full animate-pulse"></div>
                    <p className="text-sm text-gray-500">Loading your flows...</p>
                  </div>
                </div>
              ) : userFlows && userFlows.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userFlows.map(flow => (
                    <FlowCard
                      key={flow.id}
                      flow={flow}
                      onRun={() => handleExecuteFlow(flow.id)}
                      onDelete={() => {}} // Add delete functionality as needed
                      isRunning={runningFlows.has(flow.id)}
                      hasGoogleAuth={isGoogleConnected}
                      isOnCooldown={false}
                      cooldownDisplay=""
                    />
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex flex-col space-y-4">
                      <p>You haven't created any flows yet.</p>
                      <div>
                        <Button onClick={() => setActiveTab('create')} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Create your first flow
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Performance Monitor */}
          {performanceData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Monitor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600">
                  Performance data for the last {performanceData.length} executions
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create New Flow</CardTitle>
              <CardDescription>
                Set up a new automated flow to save Gmail attachments to Google Drive
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">Flow creation form will be implemented here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Debug Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <TokenDebugPanel />
          <SavedTokensPanel />
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Debug Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.map(log => (
                  <div 
                    key={log.id} 
                    className={`text-xs p-2 rounded ${log.isError ? 'bg-red-50 text-red-800' : 'bg-gray-50'}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono">{log.message}</span>
                      <span className="text-gray-400 ml-2">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FlowManager;
