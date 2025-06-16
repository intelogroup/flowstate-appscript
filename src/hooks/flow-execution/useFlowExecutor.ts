
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

    // NEW: Extract Google OAuth token with proper fallback logic
    // According to Apps Script release notes, the Google OAuth token can be in either location
    const googleOAuthToken = session.provider_token || session.access_token;
    const supabaseAccessToken = session.access_token;
    const refreshToken = session.refresh_token;

    console.log('[FLOW EXECUTOR] Enhanced token analysis:', {
      hasSession: !!session,
      hasUser: !!session.user,
      hasSupabaseToken: !!supabaseAccessToken,
      hasProviderToken: !!session.provider_token,
      hasAccessToken: !!session.access_token,
      hasRefreshToken: !!refreshToken,
      provider: session.user?.app_metadata?.provider,
      isGoogleConnected,
      // Enhanced token analysis
      providerTokenLength: session.provider_token?.length || 0,
      accessTokenLength: session.access_token?.length || 0,
      refreshTokenLength: refreshToken?.length || 0,
      // Which token we're using as Google OAuth
      usingProviderToken: !!session.provider_token,
      usingAccessTokenFallback: !session.provider_token && !!session.access_token,
      // Safe token previews for debugging
      providerTokenStart: session.provider_token?.substring(0, 20) || 'none',
      accessTokenStart: session.access_token?.substring(0, 20) || 'none',
      selectedGoogleTokenStart: googleOAuthToken?.substring(0, 20) || 'none'
    });

    if (!googleOAuthToken) {
      const errorMsg = "Google OAuth token not found in either provider_token or access_token. Please refresh your authentication.";
      addLog(errorMsg, true);
      addLog("🔧 Attempting to refresh session automatically...", false);
      
      try {
        await refreshSession();
        // After refresh, check again
        const newGoogleToken = session?.provider_token || session?.access_token;
        
        if (!newGoogleToken) {
          toast({
            title: "🔴 Google Token Missing",
            description: "Please sign out and sign in again with Google to get proper OAuth tokens.",
            variant: "destructive"
          });
          return null;
        }
      } catch (refreshError) {
        addLog(`❌ Session refresh failed: ${refreshError}`, true);
        toast({
          title: "🔴 Token Issue",
          description: errorMsg,
          variant: "destructive"
        });
        return null;
      }
    }

    const startTime = Date.now();
    addLog(`🚀 Starting execution for flow: ${flow.flow_name}`);
    addLog(`🔑 Using Google OAuth token: ${!!googleOAuthToken} (${googleOAuthToken?.length || 0} chars)`);
    addLog(`📊 Token source: ${session.provider_token ? 'provider_token (Google OAuth)' : 'access_token (fallback Google OAuth)'}`);
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
        // Handle execution failure
        const errorMessage = result.error || 'Unknown error occurred';
        addLog(`❌ Flow execution failed: ${errorMessage}`, true, { duration: executionTime });
        
        // Check for authentication-specific errors
        if (errorMessage.includes('401') || errorMessage.includes('Invalid auth_token') || errorMessage.includes('authentication')) {
          addLog("🔧 Detected authentication error - this might be a Google OAuth token issue", true);
          addLog("💡 Tip: Try signing out and signing in again to refresh Google OAuth tokens", false);
          toast({
            title: "🔐 Google Authentication Error",
            description: "Your Google OAuth tokens may have expired. Please try signing out and signing in again.",
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
        addLog("💡 Tip: Try signing out and signing in again to refresh Google OAuth tokens", false);
        toast({
          title: "🔐 Google Authentication Error",
          description: "Please sign out and sign in again to refresh your Google OAuth tokens.",
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
