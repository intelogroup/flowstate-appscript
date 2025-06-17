
import { FlowService, FlowConfig, FlowExecutionResult } from '@/services/flowService';
import { useToast } from '@/hooks/use-toast';
import { ExecuteFlowAttemptOptions } from './types';
import { useFlowRetry } from './useFlowRetry';

export const useFlowAttempt = () => {
  const { toast } = useToast();
  const { handleRetry, handlePersistentError } = useFlowRetry();

  const executeFlowAttempt = async ({
    flow,
    attemptNumber,
    addLog,
    session,
    getGoogleOAuthToken
  }: ExecuteFlowAttemptOptions): Promise<FlowExecutionResult | null> => {
    // Get fresh tokens for this attempt using the new helper function
    const currentSession = session;
    const googleOAuthToken = await getGoogleOAuthToken();
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

    try {
      // Simplified user config - let Apps Script handle time filtering
      const userConfig: FlowConfig = {
        senders: flow.senders || '', // Use the new senders field
        driveFolder: flow.drive_folder,
        fileTypes: flow.file_types || [],
        userId: flow.user_id,
        flowName: flow.flow_name,
        maxEmails: 10, // Let Apps Script decide the optimal number
        enableDebugMode: true // Enable for better debugging
      };

      addLog(`📋 Using simplified payload - Apps Script will handle time filtering`);
      
      const result = await FlowService.executeFlow(flow.id, userConfig);

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
          const emailsProcessed = result.data?.processedEmails || 0;
          
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
            addLog(`⏰ Time filter applied by Apps Script: ${debugInfo.timeFilter}`);
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
          addLog(`📊 Performance: ${Math.round(perf.total_duration / 1000)}s total`);
        }
      } else {
        // Handle execution failure with potential retry logic
        const errorMessage = result.error || 'Unknown error occurred';
        
        // Check for 401 authentication errors that might be retryable
        const canRetry = await handleRetry(errorMessage, attemptNumber, addLog);
        if (canRetry) {
          return null; // Signal that retry should happen
        } else {
          // Non-auth error or second attempt failure
          const executionTime = Date.now() - startTime;
          addLog(`❌ Flow execution failed: ${errorMessage}`, true, { duration: executionTime });
          handlePersistentError(errorMessage, addLog);
        }
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Enhanced error handling for timeouts and auth issues with retry logic
      const canRetry = await handleRetry(errorMessage, attemptNumber, addLog);
      if (canRetry) {
        return null; // Signal that retry should happen
      } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        addLog(`⏱️ Flow timed out after ${Math.round(executionTime / 1000)}s - Apps Script will handle optimization`, true);
        toast({
          title: "⏱️ Flow Timeout",
          description: "The flow took too long to complete. Apps Script will optimize the search.",
          variant: "destructive"
        });
      } else {
        addLog(`❌ Flow execution failed: ${errorMessage}`, true, { duration: executionTime });
        handlePersistentError(errorMessage, addLog);
      }
      
      return null;
    }
  };

  return { executeFlowAttempt };
};
