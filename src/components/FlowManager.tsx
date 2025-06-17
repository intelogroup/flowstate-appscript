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
import CreateFlowForm from '@/components/flow/CreateFlowForm';
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
        flowName: flow.flow_name,
        emailFilter: flow.email_filter,
        driveFolder: flow.drive_folder,
        fileTypes: flow.file_types,
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
                      onExecute={() => handleExecuteFlow(flow.id)}
                      isRunning={runningFlows.has(flow.id)}
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
            <PerformanceMonitor data={performanceData} />
          )}
        </TabsContent>

        <TabsContent value="create">
          <CreateFlowForm onSuccess={() => setActiveTab('flows')} />
        </TabsContent>
      </Tabs>

      {/* Debug Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <TokenDebugPanel />
          <SavedTokensPanel />
        </div>
        <div>
          <DebugPanel logs={logs} />
        </div>
      </div>
    </div>
  );
};

export default FlowManager;
