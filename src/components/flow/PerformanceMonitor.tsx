
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Clock, Zap } from 'lucide-react';

interface PerformanceMonitorProps {
  onHealthCheck: () => Promise<boolean>;
  executionLogs: string[];
}

const PerformanceMonitor = React.memo(({ onHealthCheck, executionLogs }: PerformanceMonitorProps) => {
  const [isChecking, setIsChecking] = React.useState(false);

  const handleHealthCheck = async () => {
    setIsChecking(true);
    try {
      await onHealthCheck();
    } finally {
      setIsChecking(false);
    }
  };

  // Extract performance metrics from logs
  const performanceData = React.useMemo(() => {
    const recentLogs = executionLogs.slice(-10);
    const timeoutLogs = recentLogs.filter(log => log.includes('timeout') || log.includes('timed out'));
    const successLogs = recentLogs.filter(log => log.includes('✅') && log.includes('Duration:'));
    
    let avgDuration = 0;
    if (successLogs.length > 0) {
      const durations = successLogs.map(log => {
        const match = log.match(/Duration: (\d+)ms/);
        return match ? parseInt(match[1]) : 0;
      }).filter(d => d > 0);
      
      if (durations.length > 0) {
        avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      }
    }

    return {
      recentTimeouts: timeoutLogs.length,
      avgDuration: Math.round(avgDuration / 1000), // Convert to seconds
      recentExecutions: successLogs.length
    };
  }, [executionLogs]);

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center text-blue-700">
          <Activity className="w-5 h-5 mr-2" />
          Performance Monitor
        </CardTitle>
        <CardDescription>
          Monitor flow performance and Apps Script connectivity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <Clock className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold text-blue-700">
              {performanceData.avgDuration > 0 ? `${performanceData.avgDuration}s` : 'N/A'}
            </div>
            <div className="text-sm text-blue-600">Avg Duration</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <Zap className="w-6 h-6 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold text-green-700">
              {performanceData.recentExecutions}
            </div>
            <div className="text-sm text-green-600">Recent Success</div>
          </div>
          
          <div className={`text-center p-3 rounded-lg ${
            performanceData.recentTimeouts > 0 ? 'bg-red-50' : 'bg-gray-50'
          }`}>
            <Clock className={`w-6 h-6 mx-auto mb-2 ${
              performanceData.recentTimeouts > 0 ? 'text-red-600' : 'text-gray-600'
            }`} />
            <div className={`text-2xl font-bold ${
              performanceData.recentTimeouts > 0 ? 'text-red-700' : 'text-gray-700'
            }`}>
              {performanceData.recentTimeouts}
            </div>
            <div className={`text-sm ${
              performanceData.recentTimeouts > 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              Recent Timeouts
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            onClick={handleHealthCheck}
            disabled={isChecking}
            variant="outline"
            size="sm"
            className="w-full max-w-xs"
          >
            {isChecking ? (
              <>
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                Checking...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4 mr-2" />
                Check Apps Script Health
              </>
            )}
          </Button>
        </div>

        {performanceData.recentTimeouts > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-sm text-yellow-800">
              <strong>Performance Tip:</strong> You've had {performanceData.recentTimeouts} recent timeout(s). 
              Consider reducing the number of emails processed per flow (try 3-5 emails max) for better performance.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

PerformanceMonitor.displayName = 'PerformanceMonitor';

export default PerformanceMonitor;
