
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useFlowManagement } from '@/hooks/useFlowManagement';
import { useFlowExecutor } from '@/hooks/flow-execution/useFlowExecutor';
import { useFlowLogs } from '@/hooks/useFlowLogs';
import AuthStatusAlert from '@/components/flow/AuthStatusAlert';
import FlowsTabContent from '@/components/flow/FlowsTabContent';
import FlowFormCard from '@/components/app/FlowFormCard';
import type { UserFlow } from '@/hooks/flow-execution/types';

const FlowManager = () => {
  const { user, isGoogleConnected } = useAuth();
  const { userFlows, isLoading, refetch, deleteFlow, createFlow } = useFlowManagement();
  const { addLog } = useFlowLogs();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('flows');

  const { runningFlows, executeFlow } = useFlowExecutor({ addLog });

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
    console.log('[FLOW MANAGER] 🎯 Flow execution requested:', {
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

    console.log('[FLOW MANAGER] ✅ Flow found, preparing execution:', {
      flowId: flow.id,
      flowName: flow.flow_name,
      emailFilter: flow.email_filter,
      driveFolder: flow.drive_folder,
      userId: flow.user_id
    });

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

    console.log('[FLOW MANAGER] 🚀 Starting flow execution with UserFlow object:', userFlow);

    toast({
      title: "Flow Started",
      description: `"${flow.flow_name}" is now processing...`,
    });

    try {
      console.log('[FLOW MANAGER] 📞 Calling executeFlow...');
      const result = await executeFlow(userFlow);
      
      console.log('[FLOW MANAGER] 📥 Flow execution completed:', {
        success: result?.success,
        hasData: !!result?.data,
        hasError: !!result?.error,
        result
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
      console.error('[FLOW MANAGER] 💥 Flow execution exception:', {
        flowName: flow.flow_name,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      toast({
        title: "Flow Error",
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: "destructive",
      });
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
    </div>
  );
};

export default FlowManager;
