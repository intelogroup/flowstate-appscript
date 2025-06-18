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
import type { UserFlow } from '@/hooks/flow-execution/types';

const FlowManager = () => {
  const { user, isGoogleConnected } = useAuth();
  const { userFlows, isLoading, refetch, deleteFlow, createFlow } = useFlowManagement();
  const { addLog } = useFlowLogs();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('flows');
  const [progressModal, setProgressModal] = useState<{ isOpen: boolean; flowName: string; requestId: string | null }>({
    isOpen: false,
    flowName: '',
    requestId: null
  });

  const { runningFlows, executeFlow } = useFlowExecutor({ addLog });
  const { subscribeToFlow, getFlowProgress, clearFlowProgress } = useWebhookUpdates();

  const handleCreateFlow = async (flowData: any) => {
    try {
      await createFlow(flowData);
      setActiveTab('flows'); // Switch to flows tab after successful creation
      toast({
        title: "Flow Created",
        description: `"${flowData.flowName}" has been successfully created.`,
      });
    } catch (error) {
      console.error('Failed to create flow:', error);
      toast({
        title: "Error Creating Flow",
        description: error instanceof Error ? error.message : 'Failed to create flow',
        variant: "destructive",
      });
    }
  };

  const handleExecuteFlow = async (flowId: string) => {
    console.log('[FLOW MANAGER] 🎯 Flow execution requested with webhook integration:', {
      flowId,
      userId: user?.id,
      isGoogleConnected,
      userFlowsCount: userFlows?.length || 0
    });

    if (!user || !isGoogleConnected) {
      console.error('[FLOW MANAGER] ❌ Authentication check failed:', {
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
      console.error('[FLOW MANAGER] ❌ Flow not found:', {
        requestedFlowId: flowId,
        availableFlows: userFlows?.map(f => ({ id: f.id, name: f.flow_name })) || []
      });
      
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

    // Show progress modal and subscribe to webhook updates
    const requestId = `flow-${flowId}-${Date.now()}`;
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
      console.log('[FLOW MANAGER] 🚀 Starting flow execution with webhook integration...');
      const result = await executeFlow(userFlow);
      
      console.log('[FLOW MANAGER] 📥 Flow execution completed with webhook integration:', {
        success: result?.success,
        hasData: !!result?.data,
        hasError: !!result?.error,
        webhookEnabled: true
      });
      
      if (result?.success) {
        const attachments = result.data?.attachments || 0;
        const emails = result.data?.processedEmails || 0;
        
        console.log('[FLOW MANAGER] ✅ Flow execution successful:', {
          flowName: flow.flow_name,
          attachments,
          emails
        });
        
        toast({
          title: "Flow Completed",
          description: `Successfully processed ${attachments} attachments from ${emails} emails.`,
        });
      } else {
        const errorMsg = result?.error || 'Flow execution failed';
        console.error('[FLOW MANAGER] ❌ Flow execution failed:', {
          flowName: flow.flow_name,
          error: errorMsg,
          fullResult: result
        });
        
        toast({
          title: "Flow Failed",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[FLOW MANAGER] 💥 Flow execution exception with webhook integration:', {
        flowName: flow.flow_name,
        error: error instanceof Error ? error.message : String(error),
        webhookEnabled: true
      });
      
      toast({
        title: "Flow Error",
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: "destructive",
      });
    } finally {
      unsubscribe();
      // Keep modal open for a bit to show final results
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
      await deleteFlow(flowId);
      toast({
        title: "Flow Deleted",
        description: "The flow has been successfully deleted.",
      });
    } catch (error) {
      console.error('Failed to delete flow:', error);
      toast({
        title: "Error Deleting Flow",
        description: error instanceof Error ? error.message : 'Failed to delete flow',
        variant: "destructive",
      });
    }
  };

  const handleCloseProgressModal = () => {
    setProgressModal(prev => ({ ...prev, isOpen: false }));
    if (progressModal.requestId) {
      clearFlowProgress(progressModal.requestId);
    }
  };

  const currentProgress = progressModal.requestId ? getFlowProgress(progressModal.requestId) : null;

  return (
    <div className="space-y-6">
      <AuthStatusAlert />

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

      {/* Real-time Progress Modal */}
      <FlowProgressModal
        isOpen={progressModal.isOpen}
        onClose={handleCloseProgressModal}
        flowName={progressModal.flowName}
        progress={currentProgress}
      />
    </div>
  );
};

export default FlowManager;
