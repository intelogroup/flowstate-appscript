
export interface DetailedError {
  type: 'authentication' | 'network' | 'apps_script' | 'timeout' | 'unknown';
  message: string;
  details?: any;
  rawResponse?: any;
  timestamp: string;
}

export class FlowExecutionErrorHandler {
  static createAuthError(message: string, details?: any): DetailedError {
    return {
      type: 'authentication',
      message,
      details,
      timestamp: new Date().toISOString()
    };
  }

  static createNetworkError(message: string, details?: any): DetailedError {
    return {
      type: 'network',
      message,
      details,
      timestamp: new Date().toISOString()
    };
  }

  static createAppsScriptError(message: string, details?: any, rawResponse?: any): DetailedError {
    return {
      type: 'apps_script',
      message,
      details,
      rawResponse,
      timestamp: new Date().toISOString()
    };
  }

  static logError(error: DetailedError, context: string): void {
    console.error(`[FLOW EXECUTION] ❌ ${context}:`, error);
  }
}
