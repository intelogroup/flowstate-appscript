
import type { FlowExecutionResult } from '@/services/flowService';

export interface UserFlow {
  id: string;
  flow_name: string;
  email_filter: string;
  drive_folder: string;
  file_types: string[];
  auto_run: boolean;
  frequency: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
  senders?: string;
  google_refresh_token?: string;
}

export interface FlowExecutionHookReturn {
  runningFlows: Set<string>;
  executionLogs: string[];
  executeFlow: (flow: UserFlow) => Promise<FlowExecutionResult | null>;
  clearLogs: () => void;
  addLog: (message: string, isError?: boolean, performanceData?: any) => void;
  checkConnectivity: () => Promise<boolean>;
}

export interface FlowExecutorConfig {
  maxRetries: number;
  retryDelay: number;
  timeoutDuration: number;
}

export interface ExecutionContext {
  flow: UserFlow;
  attemptNumber: number;
  startTime: number;
  config: FlowExecutorConfig;
}

export interface LogEntry {
  id: string;
  message: string;
  timestamp: Date;
  isError?: boolean;
  performanceData?: any;
}
