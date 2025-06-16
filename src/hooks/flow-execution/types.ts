
export interface UserFlow {
  id: string;
  flow_name: string;
  email_filter: string;
  drive_folder: string;
  file_types: string[];
  auto_run: boolean;
  frequency: string;
  created_at: string;
  senders?: string; // New field from database migration
}

export interface ExecutionLog {
  message: string;
  timestamp: string;
  isError: boolean;
  performanceData?: {
    duration?: number;
  };
}

export interface FlowExecutionHookReturn {
  runningFlows: Set<string>;
  executionLogs: string[];
  executeFlow: (flow: UserFlow) => Promise<import('@/services/flowService').FlowExecutionResult | null>;
  clearLogs: () => void;
  addLog: (message: string, isError?: boolean, performanceData?: any) => void;
  checkConnectivity: () => Promise<boolean>;
}
