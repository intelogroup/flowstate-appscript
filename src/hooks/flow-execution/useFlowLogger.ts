
import { useState, useCallback } from 'react';
import type { LogEntry } from './types';

export const useFlowLogger = () => {
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string, isError: boolean = false, performanceData?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const logPrefix = isError ? '❌' : '📝';
    let logMessage = `[${timestamp}] ${message}`;
    
    if (performanceData?.duration) {
      logMessage += ` (Duration: ${performanceData.duration}ms)`;
    }
    
    console.log(`[FLOW EXECUTION] ${logMessage}`);
    
    setExecutionLogs(prev => [...prev, `${logPrefix} ${logMessage}`]);
  }, []);

  const clearLogs = useCallback(() => {
    setExecutionLogs([]);
  }, []);

  return {
    executionLogs,
    addLog,
    clearLogs
  };
};
