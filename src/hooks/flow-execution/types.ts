
import type { FlowExecutionResult } from '@/services/flowService';

export interface UserFlow {
  id: string;
  flow_name: string;
  senders: string;
  drive_folder: string;
  file_types: string[];
}

export interface FlowExecutionHookReturn {
  runningFlows: Set<string>;
  executionLogs: string[];
  executeFlow: (flow: UserFlow) => Promise<FlowExecutionResult | null>;
  clearLogs: () => void;
  addLog: (message: string, isError?: boolean, performanceData?: any) => void;
  checkConnectivity: () => Promise<void>;
}

export interface ExecuteFlowAttemptOptions {
  flow: UserFlow;
  attemptNumber: number;
  addLog: (message: string, isError?: boolean, performanceData?: any) => void;
  session: any;
  getGoogleOAuthToken: () => string | null;
}
