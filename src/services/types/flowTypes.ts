
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
    rawResponse?: any;
  };
  error?: string;
  details?: {
    duration?: number;
    flowId?: string;
    userId?: string;
    timestamp?: string;
    appsScriptResponse?: any;
    rawResponse?: any;
    unexpectedFormat?: boolean;
    authenticationDetails?: {
      hasSession: boolean;
      sessionError?: any;
      hasAccessToken: boolean;
    };
    requestDetails?: {
      url: string;
      headers: Record<string, string>;
      payload: any;
    };
    responseDetails?: {
      status: number;
      statusText: string;
      responseText: string;
      fetchDuration: number;
    };
  };
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
