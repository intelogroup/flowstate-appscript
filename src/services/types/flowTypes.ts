
export interface FlowConfig {
  senders?: string;
  emailFilter?: string;
  driveFolder: string;
  fileTypes: string[];
  userId: string;
  flowName: string;
  maxEmails?: number;
  enableDebugMode?: boolean;
}

export interface FlowExecutionResult {
  success: boolean;
  data?: {
    attachments: number;
    processedEmails: number;
    emailsFound: number;
    performance_metrics?: {
      total_duration: number;
    };
    debugInfo?: any;
  };
  error?: string;
}

export interface CreateFlowData {
  flowName: string;
  emailFilter: string;
  driveFolder: string;
  fileTypes: string[];
  autoRun: boolean;
  frequency: string;
  userId: string;
}

export interface FlowValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface FlowExecutionMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  attachmentsProcessed: number;
  emailsProcessed: number;
}
