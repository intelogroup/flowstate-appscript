
import { useState, useEffect, useCallback } from 'react';

interface WebhookUpdate {
  type: string;
  status: string;
  message: string;
  timestamp: string;
  requestId: string;
  authenticatedUser: string | null;
  version: string;
  data: any;
}

interface FlowProgress {
  status: 'idle' | 'started' | 'processing' | 'completed' | 'error';
  message: string;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  results?: {
    emailsFound: number;
    attachmentsSaved: number;
    processingTime: string;
  };
  files?: any[];
  error?: string;
}

export const useWebhookUpdates = () => {
  const [flowProgress, setFlowProgress] = useState<Record<string, FlowProgress>>({});
  const [isConnected, setIsConnected] = useState(false);

  const handleWebhookUpdate = useCallback((update: WebhookUpdate) => {
    console.log('[WEBHOOK UPDATES] 📨 Received update:', {
      requestId: update.requestId,
      status: update.status,
      message: update.message,
      hasData: !!update.data
    });

    setFlowProgress(prev => ({
      ...prev,
      [update.requestId]: {
        status: update.status as any,
        message: update.message,
        progress: update.data?.progress,
        results: update.data?.results,
        files: update.data?.files,
        error: update.data?.error?.message
      }
    }));
  }, []);

  const subscribeToFlow = useCallback((requestId: string) => {
    console.log('[WEBHOOK UPDATES] 🔔 Subscribing to flow updates:', requestId);
    
    // Initialize flow progress
    setFlowProgress(prev => ({
      ...prev,
      [requestId]: {
        status: 'idle',
        message: 'Initializing flow...'
      }
    }));

    // In a real implementation, you would:
    // 1. Connect to WebSocket or Server-Sent Events
    // 2. Listen for updates with matching requestId
    // 3. Call handleWebhookUpdate when updates arrive

    // For now, simulate connection
    setIsConnected(true);
    
    return () => {
      console.log('[WEBHOOK UPDATES] 🔇 Unsubscribing from flow updates:', requestId);
      setIsConnected(false);
    };
  }, [handleWebhookUpdate]);

  const getFlowProgress = useCallback((requestId: string): FlowProgress | null => {
    return flowProgress[requestId] || null;
  }, [flowProgress]);

  const clearFlowProgress = useCallback((requestId: string) => {
    setFlowProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[requestId];
      return newProgress;
    });
  }, []);

  return {
    subscribeToFlow,
    getFlowProgress,
    clearFlowProgress,
    isConnected,
    allFlowProgress: flowProgress
  };
};
