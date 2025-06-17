
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Plus, RefreshCw, Workflow } from 'lucide-react';
import FlowCard from './FlowCard';

interface FlowsTabContentProps {
  isLoading: boolean;
  userFlows: any[] | undefined;
  runningFlows: Set<string>;
  isGoogleConnected: boolean;
  onRefresh: () => void;
  onExecuteFlow: (flowId: string) => void;
  onDeleteFlow?: (flowId: string) => void;
  onCreateTab: () => void;
}

const FlowsTabContent = ({
  isLoading,
  userFlows,
  runningFlows,
  isGoogleConnected,
  onRefresh,
  onExecuteFlow,
  onDeleteFlow,
  onCreateTab
}: FlowsTabContentProps) => {
  const handleRunFlow = (flow: any) => {
    console.log('[FLOWS_TAB] Running flow:', flow.id, flow.flow_name);
    onExecuteFlow(flow.id);
  };

  const handleDeleteFlow = (flowId: string) => {
    console.log('[FLOWS_TAB] Deleting flow:', flowId);
    if (onDeleteFlow) {
      onDeleteFlow(flowId);
    }
  };

  const getCooldownInfo = (flowId: string) => {
    // Simple cooldown logic - no cooldown for now
    return { isOnCooldown: false, displayTime: '' };
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">My Flows</h2>
          <p className="text-muted-foreground">
            Manage and monitor your automated workflows
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={onCreateTab} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Flow
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse opacity-75"></div>
                <div className="absolute inset-0 w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-ping opacity-25"></div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-medium text-gray-900">Loading your flows</h3>
                <p className="text-sm text-gray-500">Please wait while we fetch your automation workflows...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : userFlows && userFlows.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Workflow className="h-4 w-4" />
              <span>{userFlows.length} flow{userFlows.length !== 1 ? 's' : ''} configured</span>
            </div>
          </div>
          
          <div className="grid gap-4">
            {userFlows.map(flow => {
              const cooldownInfo = getCooldownInfo(flow.id);
              
              return (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  onRun={handleRunFlow}
                  onDelete={handleDeleteFlow}
                  isRunning={runningFlows.has(flow.id)}
                  hasGoogleAuth={isGoogleConnected}
                  isOnCooldown={cooldownInfo.isOnCooldown}
                  cooldownDisplay={cooldownInfo.displayTime}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="border-dashed border-2">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-6 text-center">
              <div className="relative">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <Workflow className="h-8 w-8 text-gray-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <Plus className="h-3 w-3 text-white" />
                </div>
              </div>
              
              <div className="space-y-2 max-w-md">
                <h3 className="text-lg font-semibold text-gray-900">No flows yet</h3>
                <p className="text-gray-500">
                  Get started by creating your first automation flow to save Gmail attachments to Google Drive automatically.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={onCreateTab} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create your first flow
                </Button>
                <Button variant="outline" className="gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Learn more
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FlowsTabContent;
