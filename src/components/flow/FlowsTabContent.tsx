
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Plus, RefreshCw } from 'lucide-react';
import FlowCard from './FlowCard';

interface FlowsTabContentProps {
  isLoading: boolean;
  userFlows: any[] | undefined;
  runningFlows: Set<string>;
  isGoogleConnected: boolean;
  onRefresh: () => void;
  onExecuteFlow: (flowId: string) => void;
  onCreateTab: () => void;
}

const FlowsTabContent = ({
  isLoading,
  userFlows,
  runningFlows,
  isGoogleConnected,
  onRefresh,
  onExecuteFlow,
  onCreateTab
}: FlowsTabContentProps) => {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">My Flows</h2>
        <Button 
          variant="outline" 
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

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
                  onRun={() => onExecuteFlow(flow.id)}
                  onDelete={() => {}}
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
                    <Button onClick={onCreateTab} size="sm">
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
    </>
  );
};

export default FlowsTabContent;
