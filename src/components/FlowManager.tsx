
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useFlowManagement } from '@/hooks/useFlowManagement';
import { useFlowExecutor } from '@/hooks/flow-execution/useFlowExecutor';
import { useFlowLogs } from '@/hooks/useFlowLogs';
import { useWebhookUpdates } from '@/hooks/useWebhookUpdates';
import AuthStatusAlert from '@/components/flow/AuthStatusAlert';
import FlowsTabContent from '@/components/flow/FlowsTabContent';
import FlowFormCard from '@/components/app/FlowFormCard';
import FlowProgressModal from '@/components/flow/FlowProgressModal';
import FlowDebugPanel from '@/components/flow/FlowDebugPanel';
import FlowStatusDashboard from '@/components/flow/FlowStatusDashboard';
import type { UserFlow } from '@/hooks/flow-execution/types';

interface DebugLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  category: 'auth' | 'network' | 'apps_script' | 'webhook' | 'ui';
  message: string;
  details?: any;
}

const FlowManager = () => {
  const { user, isGoogleConnected } = useAuth();
  const { userFlows, isLoading, refetch, deleteFlow, createFlow } = useFlowManagement();
  const { addLog } = useFlowLogs();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('flows');
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const [progressModal, setProgressModal] = useState<{ 
    isOpen: boolean; 
    flowName: string; 
    requestId: string | null;
  }>({
    isOpen: false,
    flowName: '',
    requestId: null
  });

  const { runningFlows, executeFlow } = useFlowExecutor({ addLog });
  const { subscribeToFlow, getFlowProgress, clearFlowProgress } = useWebhookUpdates();

  const addDebugLog = (
    level: DebugLog['level'], 
    category: DebugLog['category'], 
    message: string, 
    details?: any
  ) => {
    const newLog: DebugLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      category,
      message,
      details
    };
    
    setDebugLogs(prev => [newLog, ...prev.slice(0, 99)]);
  };

  const clearDebugLogs = () => {
    setDebugLogs([]);
  };

  const handleCreateFlow = async (flowData: any) => {
    try {
      addDebugLog('info', 'ui', `Creating new flow: ${flowData.flowName}`);
      await createFlow(flowData);
      setActiveTab('flows');
      addDebugLog('success', 'ui', `Flow "${flowData.flowName}" created successfully`);
      toast({
        title: "Flow Created",
        description: `"${flowData.flowName}" has been successfully created.`,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create flow';
      addDebugLog('error', 'ui', `Failed to create flow: ${errorMsg}`, { error });
      console.error('Failed to create flow:', error);
      toast({
        title: "Error Creating Flow",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleExecuteFlow = async (flowId: string) => {
    addDebugLog('info', 'ui', `Flow execution requested for flow: ${flowId}`);

    if (!user || !isGoogleConnected) {
      addDebugLog('error', 'auth', 'Authentication check failed', {
        hasUser: !!user,
        isGoogleConnected,
        userId: user?.id
      });
      
      toast({
        title: "Authentication Required",
        description: "Please connect your Google account to run flows.",
        variant: "destructive",
      });
      return;
    }

    const flow = userFlows?.find(f => f.id === flowId);
    if (!flow) {
      addDebugLog('error', 'ui', `Flow not found: ${flowId}`);
      toast({
        title: "Flow Not Found",
        description: "The selected flow could not be found.",
        variant: "destructive",
      });
      return;
    }

    const userFlow: UserFlow = {
      id: flow.id,
      flow_name: flow.flow_name,
      email_filter: flow.email_filter,
      drive_folder: flow.drive_folder,
      file_types: flow.file_types,
      auto_run: flow.auto_run,
      frequency: flow.frequency,
      user_id: flow.user_id,
      created_at: flow.created_at,
      updated_at: flow.updated_at,
      senders: flow.senders,
      google_refresh_token: flow.google_refresh_token
    };

    const requestId = `flow-${flowId}-${Date.now()}`;
    addDebugLog('info', 'webhook', `Starting flow execution with request ID: ${requestId}`);
    
    setProgressModal({
      isOpen: true,
      flowName: flow.flow_name,
      requestId
    });

    const unsubscribe = subscribeToFlow(requestId);

    toast({
      title: "Flow Started",
      description: `"${flow.flow_name}" is now processing with real-time updates...`,
    });

    try {
      addDebugLog('info', 'apps_script', `Executing flow: ${flow.flow_name}`);
      const result = await executeFlow(userFlow);
      
      if (result?.success) {
        const attachments = result.data?.attachments || 0;
        const emails = result.data?.processedEmails || 0;
        
        addDebugLog('success', 'apps_script', `Flow completed successfully: ${attachments} attachments from ${emails} emails`, result.data);
        
        toast({
          title: "Flow Completed",
          description: `Successfully processed ${attachments} attachments from ${emails} emails.`,
        });
      } else {
        const errorMsg = result?.error || 'Flow execution failed';
        addDebugLog('error', 'apps_script', `Flow execution failed: ${errorMsg}`, result);
        
        toast({
          title: "Flow Failed",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      addDebugLog('error', 'network', `Flow execution exception: ${errorMsg}`, { error });
      
      toast({
        title: "Flow Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      unsubscribe();
      setTimeout(() => {
        setProgressModal(prev => ({ ...prev, isOpen: false }));
        if (requestId) {
          clearFlowProgress(requestId);
        }
      }, 3000);
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    try {
      addDebugLog('info', 'ui', `Deleting flow: ${flowId}`);
      await deleteFlow(flowId);
      addDebugLog('success', 'ui', `Flow deleted successfully: ${flowId}`);
      toast({
        title: "Flow Deleted",
        description: "The flow has been successfully deleted.",
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to delete flow';
      addDebugLog('error', 'ui', `Failed to delete flow: ${errorMsg}`, { error });
      console.error('Failed to delete flow:', error);
      toast({
        title: "Error Deleting Flow",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleRetryFlow = () => {
    if (progressModal.requestId) {
      const flowId = progressModal.requestId.split('-')[1];
      if (flowId) {
        handleExecuteFlow(flowId);
      }
    }
  };

  const handleCloseProgressModal = () => {
    setProgressModal(prev => ({ ...prev, isOpen: false }));
    if (progressModal.requestId) {
      clearFlowProgress(progressModal.requestId);
    }
  };

  const currentProgress = progressModal.requestId ? getFlowProgress(progressModal.requestId) : null;

  const connectionStatus = {
    supabase: !!user,
    appsScript: true, // Will be updated by health checks
    webhook: true // Will be updated by health checks
  };

  const authStatus = {
    isAuthenticated: !!user,
    hasGoogleConnection: isGoogleConnected,
    tokenValid: !!user && isGoogleConnected
  };

  return (
    <div className="space-y-6">
      <AuthStatusAlert />

      {/* Status Dashboard */}
      <FlowStatusDashboard onShowDebug={() => setIsDebugPanelOpen(true)} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 bg-white shadow-sm border">
          <TabsTrigger 
            value="flows" 
            className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200"
          >
            My Flows
          </TabsTrigger>
          <TabsTrigger 
            value="create"
            className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200"
          >
            Create Flow
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flows" className="space-y-4 mt-6">
          <FlowsTabContent
            isLoading={isLoading}
            userFlows={userFlows}
            runningFlows={runningFlows}
            isGoogleConnected={isGoogleConnected}
            onRefresh={refetch}
            onExecuteFlow={handleExecuteFlow}
            onDeleteFlow={handleDeleteFlow}
            onCreateTab={() => setActiveTab('create')}
          />
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <FlowFormCard onFlowCreate={handleCreateFlow} />
        </TabsContent>
      </Tabs>

      {/* Enhanced Progress Modal */}
      <FlowProgressModal
        isOpen={progressModal.isOpen}
        onClose={handleCloseProgressModal}
        flowName={progressModal.flowName}
        progress={currentProgress}
        onRetry={handleRetryFlow}
        onShowDebug={() => setIsDebugPanelOpen(true)}
      />

      {/* Debug Panel */}
      <FlowDebugPanel
        isOpen={isDebugPanelOpen}
        onClose={() => setIsDebugPanelOpen(false)}
        logs={debugLogs}
        onClearLogs={clearDebugLogs}
        connectionStatus={connectionStatus}
        authStatus={authStatus}
      />
    </div>
  );
};

export default FlowManager;
