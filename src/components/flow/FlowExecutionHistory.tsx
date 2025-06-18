
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FlowExecutionLogger } from '@/services/flowExecutionLogger';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, XCircle, Clock, FileText, Mail, RefreshCw } from 'lucide-react';

interface ExecutionLog {
  id: string;
  flow_name: string;
  started_at: string;
  completed_at: string | null;
  success: boolean;
  attachments_processed: number | null;
  emails_found: number | null;
  emails_processed: number | null;
  total_duration_ms: number | null;
  error_message: string | null;
}

interface FlowExecutionHistoryProps {
  flowId?: string;
  limit?: number;
}

const FlowExecutionHistory = ({ flowId, limit = 10 }: FlowExecutionHistoryProps) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const [logsData, statsData] = await Promise.all([
        FlowExecutionLogger.getRecentExecutions(user.id, limit),
        FlowExecutionLogger.getFlowStats(user.id, flowId)
      ]);
      
      setLogs(logsData as ExecutionLog[]);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch execution data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id, flowId, limit]);

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Execution History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading execution history...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Execution Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold text-lg">{stats.totalExecutions}</div>
                <div className="text-gray-600">Total Runs</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg text-green-600">{stats.successRate}%</div>
                <div className="text-gray-600">Success Rate</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">{formatDuration(stats.avgDuration)}</div>
                <div className="text-gray-600">Avg Duration</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">{stats.totalAttachments}</div>
                <div className="text-gray-600">Attachments</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Recent Executions
          </CardTitle>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No execution history found
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    {log.success ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <div className="font-medium">{log.flow_name}</div>
                      <div className="text-sm text-gray-500">
                        {formatDate(log.started_at)}
                      </div>
                      {log.error_message && (
                        <div className="text-sm text-red-600 mt-1">
                          {log.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm">
                    {log.success && (
                      <>
                        <div className="flex items-center text-blue-600">
                          <Mail className="w-4 h-4 mr-1" />
                          {log.emails_processed || 0}
                        </div>
                        <div className="flex items-center text-green-600">
                          <FileText className="w-4 h-4 mr-1" />
                          {log.attachments_processed || 0}
                        </div>
                      </>
                    )}
                    <div className="text-gray-500">
                      {formatDuration(log.total_duration_ms)}
                    </div>
                    <Badge variant={log.success ? "default" : "destructive"}>
                      {log.success ? "Success" : "Failed"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FlowExecutionHistory;
