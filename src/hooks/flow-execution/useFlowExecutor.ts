
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FlowService } from '@/services/flowService';
import type { UserFlow, FlowExecutorConfig, ExecutionContext } from './types';

interface UseFlowExecutorProps {
  addLog: (message: string, isError?: boolean, performanceData?: any) => void;
}

const DEFAULT_CONFIG: FlowExecutorConfig = {
  maxRetries: 2,
  retryDelay: 1000,
  timeoutDuration: 30000
};

export const useFlowExecutor = ({ addLog }: UseFlowExecutorProps) => {
  const [runningFlows, setRunningFlows] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const createExecutionContext = useCallback((flow: UserFlow): ExecutionContext => ({
    flow,
    attemptNumber: 1,
    startTime: Date.now(),
    config: DEFAULT_CONFIG
  }), []);

  const buildFlowConfig = useCallback((flow: UserFlow) => {
    const config = {
      senders: flow.senders || flow.email_filter,
      driveFolder: flow.drive_folder,
      fileTypes: flow.file_types,
      userId: flow.user_id,
      flowName: flow.flow_name,
      maxEmails: 10,
      enableDebugMode: true
    };
    
    console.log('[FLOW EXECUTOR] 📋 Built flow config:', config);
    return config;
  }, []);

  const executeFlow = useCallback(async (flow: UserFlow) => {
    console.log('[FLOW EXECUTOR] 🚀 Starting flow execution for:', {
      flowId: flow.id,
      flowName: flow.flow_name,
      userId: flow.user_id,
      userExists: !!user
    });

    console.log('[FLOW EXECUTOR] 🔐 Auth context details:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      userMetadata: user?.user_metadata,
      appMetadata: user?.app_metadata,
      sessionExists: !!user
    });

    if (!user) {
      const errorMsg = "Authentication required to execute flows";
      console.error('[FLOW EXECUTOR] ❌ Missing authorization - No user found:', {
        errorMsg,
        authContext: 'No user session available',
        timestamp: new Date().toISOString()
      });
      addLog(errorMsg, true);
      throw new Error(errorMsg);
    }

    console.log('[FLOW EXECUTOR] ✅ User authenticated successfully:', {
      userId: user.id,
      userEmail: user.email,
      hasSession: true,
      sessionId: user.id,
      timestamp: new Date().toISOString()
    });

    const context = createExecutionContext(flow);
    setRunningFlows(prev => new Set(prev).add(flow.id));
    
    addLog(`🚀 Starting flow execution: ${flow.flow_name}`);

    try {
      const flowConfig = buildFlowConfig(flow);
      
      console.log('[FLOW EXECUTOR] 🔧 About to call FlowService.executeFlow with auth details:', {
        flowId: flow.id,
        flowConfig,
        hasUser: !!user,
        userId: user.id,
        userEmail: user.email,
        authHeaders: 'Will be handled by FlowService',
        timestamp: new Date().toISOString()
      });
      
      addLog(`🔑 Authenticating with Apps Script using shared secret for ${flow.flow_name}`);

      console.log('[FLOW EXECUTOR] 📞 Calling FlowService.executeFlow...');
      const result = await FlowService.executeFlow(flow.id, flowConfig);
      
      console.log('[FLOW EXECUTOR] 📥 Received result from FlowService:', {
        success: result?.success,
        hasError: !!result?.error,
        hasData: !!result?.data,
        result,
        timestamp: new Date().toISOString()
      });

      if (result?.success) {
        const attachments = result.data?.attachments || 0;
        const emails = result.data?.processedEmails || 0;
        
        console.log('[FLOW EXECUTOR] ✅ Flow execution successful:', {
          flowName: flow.flow_name,
          attachments,
          emails,
          performanceMetrics: result.data?.performance_metrics,
          authMethod: 'shared-secret',
          timestamp: new Date().toISOString()
        });
        
        addLog(
          `✅ Flow "${flow.flow_name}" completed successfully! Processed ${attachments} attachments from ${emails} emails.`,
          false,
          result.data?.performance_metrics
        );
        return result;
      } else {
        const errorMsg = result?.error || 'Unknown error occurred during flow execution';
        
        console.error('[FLOW EXECUTOR] ❌ Flow execution failed:', {
          flowName: flow.flow_name,
          error: errorMsg,
          fullResult: result,
          authRelated: errorMsg.includes('authorization') || errorMsg.includes('auth') || errorMsg.includes('Authentication'),
          timestamp: new Date().toISOString()
        });
        
        addLog(`❌ Flow "${flow.flow_name}" failed: ${errorMsg}`, true);
        
        // Enhanced error analysis for authorization issues
        if (errorMsg.includes('authorization') || errorMsg.includes('Missing authorization header')) {
          console.error('[FLOW EXECUTOR] 🔐 AUTHORIZATION ERROR DETECTED:', {
            errorType: 'Missing Authorization Header',
            flowName: flow.flow_name,
            userId: user.id,
            userEmail: user.email,
            errorMessage: errorMsg,
            possibleCauses: [
              'Supabase client not passing auth headers',
              'Edge function not receiving auth context',
              'Apps Script expecting different auth format'
            ],
            debugSuggestions: [
              'Check Supabase auth token',
              'Verify edge function auth handling',
              'Check Apps Script authentication method'
            ],
            timestamp: new Date().toISOString()
          });
          throw new Error('Authentication failed: Apps Script authentication error. Please check your configuration.');
        } else if (errorMsg.includes('Authentication failed')) {
          console.error('[FLOW EXECUTOR] 🔐 Authentication failure detected:', {
            errorType: 'Authentication Failed',
            flowName: flow.flow_name,
            errorMessage: errorMsg,
            timestamp: new Date().toISOString()
          });
          throw new Error('Apps Script authentication failed. Please check your configuration.');
        } else if (errorMsg.includes('timeout')) {
          console.error('[FLOW EXECUTOR] ⏰ Timeout detected');
          throw new Error('Flow execution timed out. Please try again or check your Gmail settings.');
        } else if (errorMsg.includes('Gmail API')) {
          console.error('[FLOW EXECUTOR] 📧 Gmail API error detected');
          throw new Error('Gmail access error. Please reconnect your Google account.');
        } else if (errorMsg.includes('Drive')) {
          console.error('[FLOW EXECUTOR] 💾 Drive error detected');
          throw new Error('Google Drive access error. Please check folder permissions.');
        }
        
        throw new Error(errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      
      console.error('[FLOW EXECUTOR] 💥 Exception during flow execution:', {
        flowName: flow.flow_name,
        error: errorMsg,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : 'No stack trace available',
        authRelated: errorMsg.includes('authorization') || errorMsg.includes('auth'),
        timestamp: new Date().toISOString()
      });
      
      if (errorMsg.includes('authorization') || errorMsg.includes('Missing authorization header')) {
        console.error('[FLOW EXECUTOR] 🔐 CRITICAL AUTH ERROR:', {
          message: 'Authorization header missing in flow execution chain',
          flowId: flow.id,
          userId: user.id,
          userEmail: user.email,
          errorMessage: errorMsg,
          timestamp: new Date().toISOString()
        });
      }
      
      addLog(`❌ Error executing flow "${flow.flow_name}": ${errorMsg}`, true);
      
      // Re-throw the error so it can be caught by the UI layer
      throw error;
    } finally {
      console.log('[FLOW EXECUTOR] 🏁 Flow execution completed, cleaning up:', {
        flowId: flow.id,
        flowName: flow.flow_name,
        timestamp: new Date().toISOString()
      });
      
      setRunningFlows(prev => {
        const newSet = new Set(prev);
        newSet.delete(flow.id);
        return newSet;
      });
    }
  }, [user, addLog, createExecutionContext, buildFlowConfig]);

  return {
    runningFlows,
    executeFlow
  };
};
