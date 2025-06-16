
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { FlowService, FlowConfig, FlowExecutionResult } from '@/services/flowService';
import type { UserFlow } from './types';

interface UseFlowExecutorProps {
  addLog: (message: string, isError?: boolean, performanceData?: any) => void;
}

export const useFlowExecutor = ({ addLog }: UseFlowExecutorProps) => {
  const [runningFlows, setRunningFlows] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { session, isGoogleConnected, refreshSession } = useAuth();

  const executeFlow = useCallback(async (flow: UserFlow): Promise<FlowExecutionResult | null> => {
    if (!session || !session.user) {
      const errorMsg = "Authentication required to execute flows";
      addLog(errorMsg, true);
      toast({
        title: "🔴 Authentication Required",
        description: errorMsg,
        variant: "destructive"
      });
      return null;
    }

    if (!isGoogleConnected) {
      const errorMsg = "Google authentication required. Please connect your Google account.";
      addLog(errorMsg, true);
      toast({
        title: "🔴 Google Authentication Required", 
        description: errorMsg,
        variant: "destructive"
      });
      return null;
    }

    // Enhanced token validation and extraction
    const accessToken = session.access_token || session.provider_token;
    const refreshToken = session.refresh_token;
    const providerToken = session.provider_token;

    console.log('[FLOW EXECUTOR] Session debug:', {
      hasSession: !!session,
      hasUser: !!session.user,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      hasProviderToken: !!providerToken,
      provider: session.user?.app_metadata?.provider,
      isGoogleConnected,
      sessionKeys: Object.keys(session || {}),
      userKeys: Object.keys(session.user || {})
    });

    if (!accessToken && !providerToken) {
      const errorMsg = "Google OAuth tokens not found. Please refresh your authentication.";
      addLog(errorMsg, true);
      toast({
        title: "🔴 Token Issue",
        description: errorMsg,
        variant: "destructive",
        action: (
          <button 
            onClick={refreshSession}
            className="px-3 py-1 bg-white text-black rounded text-sm"
          >
            Refresh Auth
          </button>
        )
      });
      return null;
    }

    const startTime = Date.now();
    addLog(`🚀 Starting execution for flow: ${flow.flow_name}`);
    addLog(`🔑 Using Google tokens - Access: ${!!accessToken}, Provider: ${!!providerToken}`);
    setRunningFlows(prev => new Set(prev).add(flow.id));

    try {
      // Use the senders field for V.06 compatibility
      const userConfig: FlowConfig = {
        senders: flow.senders || '', // Use the new senders field
        driveFolder: flow.drive_folder,
        fileTypes: flow.file_types || [],
        userId: flow.id,
        flowName: flow.flow_name,
        maxEmails: 5, // Default to 5 emails for better performance
        enableDebugMode: true, // Enable for better debugging
        showEmailDetails: true // Show email details in debug
      };

      // Enhanced token structure - try multiple token sources
      const googleTokens = {
        access_token: accessToken || '',
        refresh_token: refreshToken || '',
        provider_token: providerToken || accessToken || ''
      };

      addLog(`📋 Using V.06 payload format with senders: ${userConfig.senders}`);
      addLog(`🔐 Tokens prepared - Access: ${googleTokens.access_token.substring(0, 20)}...`);
      
      const result = await FlowService.executeFlow(flow.id, userConfig, googleTokens);

      const executionTime = Date.now() - startTime;
      
      if (result.success) {
        addLog("✅ Flow execution completed successfully", false, { duration: executionTime });
        
        // Enhanced logging with detailed debugging information
        if (result.data && result.data.attachments > 0) {
          const perfInfo = result.data.performance_metrics ? 
            ` (Total time: ${Math.round(result.data.performance_metrics.total_duration / 1000)}s)` : '';
          addLog(`🎉 Processed ${result.data.attachments} attachments successfully${perfInfo}`);
          toast({
            title: "🎉 Flow Executed Successfully!",
            description: `${flow.flow_name} processed ${result.data.attachments} attachments.`,
          });
        } else {
          // Enhanced debugging for no attachments found
          const debugInfo = result.data?.debugInfo || {};
          const emailsFound = result.data?.emailsFound || 0;
          const emailsProcessed = result.data?.processed || 0;
          
          if (emailsFound > 0) {
            addLog(`📧 Found ${emailsFound} emails but ${emailsProcessed} were processed with 0 attachments`);
          } else {
            addLog("📧 No emails found matching your search criteria");
          }
          
          // Add specific debugging information
          if (debugInfo.searchQuery) {
            addLog(`🔍 Gmail search used: "${debugInfo.searchQuery}"`);
          }
          if (debugInfo.timeFilter) {
            addLog(`⏰ Time filter applied: ${debugInfo.timeFilter}`);
          }
          if (debugInfo.emailDetails && Array.isArray(debugInfo.emailDetails)) {
            debugInfo.emailDetails.forEach((email: any, index: number) => {
              addLog(`📨 Email ${index + 1}: Subject="${email.subject}" Date="${email.date}" Attachments=${email.attachmentCount || 0}`);
            });
          }
          
          addLog("⚠️ No attachments were found to process");
          toast({
            title: "✅ Flow Completed",
            description: `${flow.flow_name} completed - no attachments found.`,
          });
        }

        // Log performance metrics if available
        if (result.data?.performance_metrics) {
          const perf = result.data.performance_metrics;
          addLog(`📊 Performance: ${Math.round(perf.total_duration / 1000)}s total, timeout was ${Math.round(perf.timeout_used / 1000)}s`);
        }
      } else {
        // Handle execution failure
        const errorMessage = result.error || 'Unknown error occurred';
        addLog(`❌ Flow execution failed: ${errorMessage}`, true, { duration: executionTime });
        
        // Check for authentication-specific errors
        if (errorMessage.includes('401') || errorMessage.includes('Invalid auth_token') || errorMessage.includes('authentication')) {
          toast({
            title: "🔐 Authentication Error",
            description: "Your Google authentication has expired. Please refresh and try again.",
            variant: "destructive",
            action: (
              <button 
                onClick={refreshSession}
                className="px-3 py-1 bg-white text-black rounded text-sm"
              >
                Refresh Auth
              </button>
            )
          });
        } else {
          toast({
            title: "🔴 Flow Execution Failed",
            description: errorMessage.length > 100 ? 
              errorMessage.substring(0, 100) + "..." : 
              errorMessage,
            variant: "destructive"
          });
        }
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Enhanced error handling for timeouts and auth issues
      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        addLog(`⏱️ Flow timed out after ${Math.round(executionTime / 1000)}s - consider reducing email count`, true);
        toast({
          title: "⏱️ Flow Timeout",
          description: "The flow took too long to complete. Try processing fewer emails at once.",
          variant: "destructive"
        });
      } else if (errorMessage.includes('401') || errorMessage.includes('Invalid auth_token')) {
        addLog(`🔐 Authentication error: ${errorMessage}`, true);
        toast({
          title: "🔐 Authentication Error",
          description: "Please refresh your authentication and try again.",
          variant: "destructive",
          action: (
            <button 
              onClick={refreshSession}
              className="px-3 py-1 bg-white text-black rounded text-sm"
            >
              Refresh Auth
            </button>
          )
        });
      } else {
        addLog(`❌ Flow execution failed: ${errorMessage}`, true, { duration: executionTime });
        toast({
          title: "🔴 Flow Execution Failed",
          description: errorMessage.length > 100 ? 
            errorMessage.substring(0, 100) + "..." : 
            errorMessage,
          variant: "destructive"
        });
      }
      
      return null;
    } finally {
      setRunningFlows(prev => {
        const newSet = new Set(prev);
        newSet.delete(flow.id);
        return newSet;
      });
    }
  }, [session, isGoogleConnected, addLog, toast, refreshSession]);

  return {
    runningFlows,
    executeFlow
  };
};
