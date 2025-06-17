
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useFlowManagement } from '@/hooks/useFlowManagement';
import { useFlowExecutor } from '@/hooks/flow-execution/useFlowExecutor';
import { useFlowLogs } from '@/hooks/useFlowLogs';
import AuthStatusAlert from '@/components/flow/AuthStatusAlert';
import FlowsTabContent from '@/components/flow/FlowsTabContent';
import type { UserFlow } from '@/hooks/flow-execution/types';

const FlowManager = () => {
  const { user, isGoogleConnected } = useAuth();
  const { userFlows, isLoading, refetch, deleteFlow } = useFlowManagement();
  const { addLog } = useFlowLogs();
  const [activeTab, setActiveTab] = useState('flows');

  const { runningFlows, executeFlow } = useFlowExecutor({ addLog });

  const handleExecuteFlow = async (flowId: string) => {
    if (!user || !isGoogleConnected) {
      return;
    }

    const flow = userFlows?.find(f => f.id === flowId);
    if (!flow) {
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

    await executeFlow(userFlow);
  };

  const handleDeleteFlow = async (flowId: string) => {
    try {
      await deleteFlow(flowId);
    } catch (error) {
      console.error('Failed to delete flow:', error);
    }
  };

  return (
    <div className="space-y-6">
      <AuthStatusAlert />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="flows">My Flows</TabsTrigger>
          <TabsTrigger value="create">Create Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="flows" className="space-y-4">
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
    </div>
  );
};

export default FlowManager;
