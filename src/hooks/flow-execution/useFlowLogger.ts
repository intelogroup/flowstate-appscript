
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useFlowLogger = () => {
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const { toast } = useToast();

  const addLog = useCallback((message: string, isError: boolean = false, performanceData?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    let logMessage = `[${timestamp}] ${message}`;
    
    // Add performance data if available
    if (performanceData) {
      logMessage += ` (Duration: ${performanceData.duration || 'unknown'}ms)`;
    }
    
    console.log(`[FLOW EXECUTION] ${logMessage}`);
    setExecutionLogs(prev => [...prev.slice(-19), logMessage]);
    
    toast({
      title: isError ? "🔴 Error" : "🔍 Flow Log",
      description: message,
      variant: isError ? "destructive" : "default"
    });
  }, [toast]);

  const clearLogs = useCallback(() => {
    setExecutionLogs([]);
    toast({
      title: "🧹 Logs Cleared",
      description: "Execution logs have been cleared.",
    });
  }, [toast]);

  return {
    executionLogs,
    addLog,
    clearLogs
  };
};
