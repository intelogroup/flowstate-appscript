
import { useState } from 'react';

interface Log {
  id: string;
  message: string;
  timestamp: Date;
  isError?: boolean;
  performanceData?: any;
}

export const useFlowLogs = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);

  const addLog = (message: string, isError = false, performanceData?: any) => {
    setLogs(prev => [
      {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        message,
        timestamp: new Date(),
        isError,
        performanceData
      },
      ...prev.slice(0, 99) // Keep only the last 100 logs
    ]);

    if (performanceData) {
      setPerformanceData(prev => [...prev, { ...performanceData, timestamp: new Date() }].slice(-20));
    }
  };

  return {
    logs,
    performanceData,
    addLog
  };
};
