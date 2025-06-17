
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
  const { session, isGoogleConnected, refreshSession, forceTokenRefresh, isTokenValid, signInWithGoogle } = useAuth();

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

    // Enhanced token validation before execution
    if (!isTokenValid()) {
      addLog("🔄 Token appears expired, attempting refresh before execution...", false);
      const refreshSuccess = await forceTokenRefresh();
      
      if (!refreshSuccess) {
        const errorMsg = "Token refresh failed. Please sign in again.";
        addLog(errorMsg, true);
        toast({
          title: "🔐 Token Refresh Failed",
          description: "Please sign out and sign in again to refresh your Google OAuth tokens.",
          variant: "destructive"
        });
        return null;
      }
      addLog("✅ Token refreshed successfully", false);
    }

    const executeFlowAttempt = async (attemptNumber: number): Promise<FlowExecutionResult | null> => {
      // Get fresh tokens for this attempt
      const currentSession = session;
      const googleOAuthToken = currentSession.provider_token || currentSession.access_token;
      const supabaseAccessToken = currentSession.access_token;
      const refreshToken = currentSession.refresh_token;

      console.log(`[FLOW EXECUTOR] Attempt ${attemptNumber} - Enhanced token analysis:`, {
        hasSession: !!currentSession,
        hasUser: !!currentSession.user,
        hasSupabaseToken: !!supabaseAccessToken,
        hasProviderToken: !!currentSession.provider_token,
        hasAccessToken: !!currentSession.access_token,
        hasRefreshToken: !!refreshToken,
        provider: currentSession.user?.app_metadata?.provider,
        isGoogleConnected,
        tokenIsValid: isTokenValid(),
        // Enhanced token analysis
        providerTokenLength: currentSession.provider_token?.length || 0,
        accessTokenLength: currentSession.access_token?.length || 0,
        refreshTokenLength: refreshToken?.length || 0,
        // Which token we're using as Google OAuth
        usingProviderToken: !!currentSession.provider_token,
        usingAccessTokenFallback: !currentSession.provider_token && !!currentSession.access_token,
        // Safe token previews for debugging
        providerTokenStart: currentSession.provider_token?.substring(0, 20) || 'none',
        accessTokenStart: currentSession.access_token?.substring(0, 20) || 'none',
        selectedGoogleTokenStart: googleOAuthToken?.substring(0, 20) || 'none'
      });

      if (!googleOAuthToken) {
        throw new Error("Google OAuth token not found. Token refresh may have failed.");
      }

      const startTime = Date.now();
      addLog(`🚀 Starting execution for flow: ${flow.flow_name} (Attempt ${attemptNumber})`);
      addLog(`🔑 Using Google OAuth token: ${!!googleOAuthToken} (${googleOAuthToken?.length || 0} chars)`);
      addLog(`📊 Token source: ${currentSession.provider_token ? 'provider_token (Google OAuth)' : 'access_token (fallback Google OAuth)'}`);
      
      if (attemptNumber === 1) {
        setRunningFlows(prev => new Set(prev).add(flow.id));
      }

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

        // Use the correct Google OAuth token for Apps Script
        const googleTokens = {
          access_token: googleOAuthToken || '', // Use the Google OAuth token we found
          refresh_token: refreshToken || '',
          provider_token: googleOAuthToken || '' // Same as access_token for consistency
        };

        addLog(`📋 Using V.06 payload format with senders: ${userConfig.senders}`);
        addLog(`🔐 Google OAuth token prepared: ${googleTokens.access_token.substring(0, 20)}...`);
        
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
          // Handle execution failure with potential retry logic
          const errorMessage = result.error || 'Unknown error occurred';
          
          // Check for 401 authentication errors that might be retryable
          if ((errorMessage.includes('401') || errorMessage.includes('Invalid auth_token') || errorMessage.includes('Unauthorized')) && attemptNumber === 1) {
            addLog(`🔄 Attempt ${attemptNumber} failed with auth error: ${errorMessage}`, true);
            addLog("🔄 Attempting token refresh and retry...", false);
            
            const refreshSuccess = await forceTokenRefresh();
            if (refreshSuccess) {
              addLog("✅ Token refresh successful, retrying flow execution...", false);
              return executeFlowAttempt(2); // Retry once with fresh token
            } else {
              addLog("❌ Token refresh failed, cannot retry", true);
              throw new Error("Authentication failed and token refresh unsuccessful");
            }
          } else {
            // Non-auth error or second attempt failure
            addLog(`❌ Flow execution failed: ${errorMessage}`, true, { duration: executionTime });
            
            // Check for authentication-specific errors
            if (errorMessage.includes('401') || errorMessage.includes('Invalid auth_token') || errorMessage.includes('authentication')) {
              addLog("🔧 Detected persistent authentication error after retry", true);
              addLog("💡 Recommendation: Sign out completely and sign in again to get fresh Google OAuth tokens", false);
              toast({
                title: "🔐 Persistent Authentication Error",
                description: "Please sign out and sign in again to refresh your Google OAuth tokens.",
                variant: "destructive"
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
        }

        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        // Enhanced error handling for timeouts and auth issues with retry logic
        if ((errorMessage.includes('401') || errorMessage.includes('Invalid auth_token') || errorMessage.includes('Unauthorized')) && attemptNumber === 1) {
          addLog(`🔄 Network error with auth issue (attempt ${attemptNumber}): ${errorMessage}`, true);
          addLog("🔄 Attempting token refresh and retry...", false);
          
          const refreshSuccess = await forceTokenRefresh();
          if (refreshSuccess) {
            addLog("✅ Token refresh successful, retrying flow execution...", false);
            return executeFlowAttempt(2); // Retry once with fresh token
          } else {
            addLog("❌ Token refresh failed, cannot retry", true);
            toast({
              title: "🔐 Authentication & Refresh Failed",
              description: "Please sign out and sign in again to get fresh Google OAuth tokens.",
              variant: "destructive"
            });
          }
        } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
          addLog(`⏱️ Flow timed out after ${Math.round(executionTime / 1000)}s - consider reducing email count`, true);
          toast({
            title: "⏱️ Flow Timeout",
            description: "The flow took too long to complete. Try processing fewer emails at once.",
            variant: "destructive"
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
      }
    };

    try {
      return await executeFlowAttempt(1);
    } finally {
      setRunningFlows(prev => {
        const newSet = new Set(prev);
        newSet.delete(flow.id);
        return newSet;
      });
    }
  }, [session, isGoogleConnected, addLog, toast, forceTokenRefresh, isTokenValid]);

  return {
    runningFlows,
    executeFlow
  };
};
