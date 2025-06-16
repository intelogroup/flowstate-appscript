
// Network utilities for debugging and resilience
export interface NetworkDebugInfo {
  timestamp: string;
  request_id: string;
  user_agent?: string;
  debug_source?: string;
  payload_size: number;
  method: string;
}

export const generateRequestId = (): string => {
  return crypto.randomUUID();
};

export const extractDebugInfo = (req: Request): NetworkDebugInfo => {
  return {
    timestamp: new Date().toISOString(),
    request_id: generateRequestId(),
    user_agent: req.headers.get('x-user-agent') || req.headers.get('user-agent') || 'unknown',
    debug_source: req.headers.get('x-debug-source') || 'unknown',
    payload_size: parseInt(req.headers.get('content-length') || '0'),
    method: req.method
  };
};

export const logNetworkEvent = (event: string, info: any) => {
  console.log(`[NETWORK] ${event}:`, JSON.stringify(info, null, 2));
};

export const createRetryableError = (message: string, retryable: boolean = true) => {
  const error = new Error(message);
  (error as any).retryable = retryable;
  return error;
};
