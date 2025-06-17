
import { useState } from 'react';
import type { LogEntry } from './flow-execution/types';

export const useFlowLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);

  const addLog = (message: string, isError = false, performanceData?: any) => {
    const newLog: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      message,
      timestamp: new Date(),
      isError,
      performanceData
    };

    setLogs(prev => [newLog, ...prev.slice(0, 99)]);

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
