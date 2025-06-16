import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { FlowService, FlowConfig, FlowExecutionResult } from '@/services/flowService';

interface UserFlow {
  id: string;
  flow_name: string;
  email_filter: string;
  drive_folder: string;
  file_types: string[];
  auto_run: boolean;
  frequency: string;
  created_at: string;
  senders?: string; // New field from database migration
}

export const useFlowExecution = () => {
  const [runningFlows, setRunningFlows] = useState<Set<string>>(new Set());
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const { toast } = useToast();
  const { user, session } = useAuth();

  const addLog = useCallback((message: string, isError: boolean = false, performanceData?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    let logMessage = `[${timestamp}] ${message}`;
    
    // Add performance data if available
    if (performanceData) {
      logMessage += ` (Duration: ${performanceData.duration || 'unknown'}ms)`;
    }
    
    console.log(`[FLOW EXECUTION] ${logMessage}`);
    setExecutionLogs(prev => [...prev.slice(-19), logMessage]);
    
    toast({
      title: isError ? "🔴 Error" : "🔍 Flow Log",
      description: message,
      variant: isError ? "destructive" : "default"
    });
  }, [toast]);

  const executeFlow = useCallback(async (flow: UserFlow): Promise<FlowExecutionResult | null> => {
    if (!session) {
      const errorMsg = "Authentication required to execute flows";
      addLog(errorMsg, true);
      toast({
        title: "🔴 Authentication Required",
        description: errorMsg,
        variant: "destructive"
      });
      return null;
    }

    const startTime = Date.now();
    addLog(`🚀 Starting execution for flow: ${flow.flow_name}`);
    setRunningFlows(prev => new Set(prev).add(flow.id));

    try {
      // NEW: Use the senders field for V.06 compatibility
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

      const googleTokens = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        provider_token: session.provider_token
      };

      addLog(`📋 Using V.06 payload format with senders: ${userConfig.senders}`);
      const result = await FlowService.executeFlow(flow.id, userConfig, googleTokens);

      const executionTime = Date.now() - startTime;
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

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Enhanced error handling for timeouts
      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
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
    } finally {
      setRunningFlows(prev => {
        const newSet = new Set(prev);
        newSet.delete(flow.id);
        return newSet;
      });
    }
  }, [session, addLog, toast]);

  const clearLogs = useCallback(() => {
    setExecutionLogs([]);
    toast({
      title: "🧹 Logs Cleared",
      description: "Execution logs have been cleared.",
    });
  }, [toast]);

  // Health check for Apps Script connectivity
  const checkConnectivity = useCallback(async () => {
    addLog("🔍 Checking Apps Script connectivity...");
    try {
      const isHealthy = await FlowService.checkAppsScriptHealth();
      if (isHealthy) {
        addLog("✅ Apps Script connection is healthy");
        toast({
          title: "✅ Connection Healthy",
          description: "Apps Script endpoint is responding normally.",
        });
      } else {
        addLog("⚠️ Apps Script health check failed", true);
        toast({
          title: "⚠️ Connection Issues",
          description: "Apps Script endpoint may be experiencing issues.",
          variant: "destructive"
        });
      }
      return isHealthy;
    } catch (error) {
      addLog("❌ Health check error: " + (error instanceof Error ? error.message : 'Unknown error'), true);
      return false;
    }
  }, [addLog, toast]);

  return {
    runningFlows,
    executionLogs,
    executeFlow,
    clearLogs,
    addLog,
    checkConnectivity
  };
};
