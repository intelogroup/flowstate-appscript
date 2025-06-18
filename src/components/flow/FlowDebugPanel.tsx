
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bug, Network, Shield, Activity, Copy, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DebugLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  category: 'auth' | 'network' | 'apps_script' | 'webhook' | 'ui';
  message: string;
  details?: any;
}

interface FlowDebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  logs: DebugLog[];
  onClearLogs: () => void;
  connectionStatus: {
    supabase: boolean;
    appsScript: boolean;
    webhook: boolean;
  };
  authStatus: {
    isAuthenticated: boolean;
    hasGoogleConnection: boolean;
    tokenValid: boolean;
  };
}

const FlowDebugPanel = ({
  isOpen,
  onClose,
  logs,
  onClearLogs,
  connectionStatus,
  authStatus
}: FlowDebugPanelProps) => {
  const { toast } = useToast();
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  if (!isOpen) return null;

  const getLogLevelBadge = (level: DebugLog['level']) => {
    const variants = {
      info: 'bg-blue-100 text-blue-700',
      warning: 'bg-yellow-100 text-yellow-700', 
      error: 'bg-red-100 text-red-700',
      success: 'bg-green-100 text-green-700'
    };
    return <Badge className={variants[level]}>{level.toUpperCase()}</Badge>;
  };

  const getCategoryIcon = (category: DebugLog['category']) => {
    const icons = {
      auth: <Shield className="h-4 w-4" />,
      network: <Network className="h-4 w-4" />,
      apps_script: <Activity className="h-4 w-4" />,
      webhook: <Bug className="h-4 w-4" />,
      ui: <Activity className="h-4 w-4" />
    };
    return icons[category];
  };

  const copyLogDetails = (log: DebugLog) => {
    const logText = `[${log.timestamp}] ${log.level.toUpperCase()} ${log.category}: ${log.message}\n${log.details ? JSON.stringify(log.details, null, 2) : ''}`;
    navigator.clipboard.writeText(logText);
    toast({
      title: "Log Copied",
      description: "Log details copied to clipboard",
    });
  };

  const selectedLog = logs.find(log => log.id === selectedLogId);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl h-[80vh] flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Flow Debug Panel
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button onClick={onClearLogs} variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
              <Button onClick={onClose} variant="outline" size="sm">
                Close
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col min-h-0">
          <Tabs defaultValue="logs" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="logs">Execution Logs</TabsTrigger>
              <TabsTrigger value="status">System Status</TabsTrigger>
              <TabsTrigger value="details">Log Details</TabsTrigger>
            </TabsList>

            <TabsContent value="logs" className="flex-1 mt-4">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedLogId === log.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedLogId(log.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(log.category)}
                          {getLogLevelBadge(log.level)}
                          <span className="text-xs text-gray-500">{log.timestamp}</span>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyLogDetails(log);
                          }}
                          variant="ghost"
                          size="sm"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-sm font-mono">{log.message}</p>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      No debug logs available. Execute a flow to see logs here.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="status" className="flex-1 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Authentication Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Supabase Auth</span>
                      <Badge className={authStatus.isAuthenticated ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {authStatus.isAuthenticated ? 'Connected' : 'Disconnected'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Google Connection</span>
                      <Badge className={authStatus.hasGoogleConnection ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {authStatus.hasGoogleConnection ? 'Connected' : 'Disconnected'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Token Valid</span>
                      <Badge className={authStatus.tokenValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {authStatus.tokenValid ? 'Valid' : 'Invalid'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Connection Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Supabase</span>
                      <Badge className={connectionStatus.supabase ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {connectionStatus.supabase ? 'Connected' : 'Error'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Apps Script</span>
                      <Badge className={connectionStatus.appsScript ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {connectionStatus.appsScript ? 'Connected' : 'Error'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Webhook Handler</span>
                      <Badge className={connectionStatus.webhook ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {connectionStatus.webhook ? 'Connected' : 'Error'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="details" className="flex-1 mt-4">
              {selectedLog ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Log Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong>Timestamp:</strong> {selectedLog.timestamp}
                        </div>
                        <div>
                          <strong>Level:</strong> {selectedLog.level}
                        </div>
                        <div>
                          <strong>Category:</strong> {selectedLog.category}
                        </div>
                        <div>
                          <strong>ID:</strong> {selectedLog.id}
                        </div>
                      </div>
                      <div>
                        <strong>Message:</strong>
                        <p className="mt-1 font-mono text-sm bg-gray-50 p-2 rounded">{selectedLog.message}</p>
                      </div>
                      {selectedLog.details && (
                        <div>
                          <strong>Details:</strong>
                          <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-64">
                            {JSON.stringify(selectedLog.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Select a log from the "Execution Logs" tab to view details here.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default FlowDebugPanel;
