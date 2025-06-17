
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TokenDebugPanel from './TokenDebugPanel';
import SavedTokensPanel from './SavedTokensPanel';

interface Log {
  id: string;
  message: string;
  timestamp: Date;
  isError?: boolean;
  performanceData?: any;
}

interface FlowDebugSectionProps {
  logs: Log[];
  performanceData: any[];
}

const FlowDebugSection = ({ logs, performanceData }: FlowDebugSectionProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-4">
        <TokenDebugPanel />
        <SavedTokensPanel />
      </div>
      
      <div className="space-y-4">
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

        {performanceData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Performance Monitor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">
                Performance data for the last {performanceData.length} executions
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default FlowDebugSection;
