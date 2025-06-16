
import { supabase } from '@/integrations/supabase/client';

export interface FlowConfig {
  emailFilter: string;
  driveFolder: string;
  fileTypes?: string[];
  userId?: string;
  flowName?: string;
  maxEmails?: number;
}

export interface FlowExecutionResult {
  success: boolean;
  message: string;
  data?: {
    processed: number;
    attachments: number;
    files?: Array<{
      name: string;
      size: number;
      url: string;
    }>;
    errors?: string[];
    performance_metrics?: {
      total_duration: number;
      timeout_used: number;
      retries_available: number;
    };
  };
}

export class FlowService {
  private static readonly EDGE_FUNCTION_NAME = 'apps-script-proxy';

  // Enhanced timeout handling with user-friendly error messages
  private static getTimeoutErrorMessage(timeoutMs: number, emailCount?: number): string {
    const timeoutSeconds = Math.floor(timeoutMs / 1000);
    const baseMessage = `Request timed out after ${timeoutSeconds} seconds`;
    
    if (emailCount && emailCount > 10) {
      return `${baseMessage}. Try reducing the number of emails to process (currently: ${emailCount}). Consider processing fewer emails at a time for better performance.`;
    }
    
    return `${baseMessage}. Your Gmail flow is taking longer than expected. This usually happens when processing many emails or when Google's servers are slow.`;
  }

  // Enhanced retry logic for specific error types
  private static shouldRetryError(error: any): boolean {
    const retryableErrors = [
      'Network error',
      'fetch failed',
      'Failed to fetch',
      'timeout',
      'ECONNRESET',
      'ETIMEDOUT'
    ];
    
    return retryableErrors.some(retryable => 
      error.message?.toLowerCase().includes(retryable.toLowerCase())
    );
  }

  static async executeFlow(
    flowId: string,
    userConfig: FlowConfig,
    googleTokens?: any,
    retryCount: number = 0
  ): Promise<FlowExecutionResult> {
    const maxRetries = 2;
    const startTime = Date.now();
    
    try {
      const payload = {
        action: "run_flow",
        flowId,
        userConfig: {
          ...userConfig,
          maxEmails: userConfig.maxEmails || 5
        },
        googleTokens
      };

      console.log('[FLOW SERVICE] Starting flow execution:', {
        flowId,
        flowName: userConfig.flowName,
        maxEmails: userConfig.maxEmails,
        attempt: retryCount + 1
      });

      const { data, error } = await supabase.functions.invoke(this.EDGE_FUNCTION_NAME, {
        body: payload
      });

      const duration = Date.now() - startTime;

      if (error) {
        console.error('[FLOW SERVICE] Edge Function error:', error);
        
        // Check if this is a retryable error and we haven't exceeded max retries
        if (this.shouldRetryError(error) && retryCount < maxRetries) {
          const delay = Math.min(2000 * Math.pow(2, retryCount), 8000); // Exponential backoff
          console.log(`[FLOW SERVICE] Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.executeFlow(flowId, userConfig, googleTokens, retryCount + 1);
        }
        
        // Handle timeout errors specifically
        if (error.message?.includes('timeout') || error.message?.includes('AbortError')) {
          const timeoutMessage = this.getTimeoutErrorMessage(90000, userConfig.maxEmails);
          throw new Error(`${timeoutMessage}\n\nTechnical details: ${error.message}`);
        }
        
        throw new Error(`Edge Function error: ${error.message}`);
      }

      if (!data.success) {
        console.error('[FLOW SERVICE] Flow execution failed:', data);
        
        // Handle specific timeout responses from Apps Script
        if (data.error?.includes('timeout') || data.timeout_ms) {
          const timeoutMessage = this.getTimeoutErrorMessage(data.timeout_ms || 90000, userConfig.maxEmails);
          throw new Error(`${timeoutMessage}\n\nSuggestion: ${data.performance_hints?.suggested_max_emails ? 
            `Try setting maxEmails to ${data.performance_hints.suggested_max_emails} or fewer.` : 
            'Try processing fewer emails at a time.'}`);
        }
        
        throw new Error(data.error || 'Flow execution failed');
      }

      console.log('[FLOW SERVICE] Flow execution completed:', {
        duration,
        attachments: data.apps_script_response?.data?.attachments || 0,
        performance: data.performance_metrics
      });

      return {
        success: true,
        message: data.message || 'Flow executed successfully',
        data: {
          processed: data.apps_script_response?.data?.processedEmails || 0,
          attachments: data.apps_script_response?.data?.attachments || data.apps_script_response?.data?.savedAttachments || 0,
          performance_metrics: data.performance_metrics
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[FLOW SERVICE] Flow execution error:', {
        error: error.message,
        duration,
        attempt: retryCount + 1,
        flowId
      });
      throw error;
    }
  }

  static async createFlow(flowData: {
    flowName: string;
    emailFilter: string;
    driveFolder: string;
    fileTypes: string[];
    autoRun: boolean;
    frequency: string;
    userId: string;
  }) {
    const { error } = await supabase
      .from('user_configurations')
      .insert({
        user_id: flowData.userId,
        flow_name: flowData.flowName,
        email_filter: flowData.emailFilter,
        drive_folder: flowData.driveFolder,
        file_types: flowData.fileTypes,
        auto_run: flowData.autoRun,
        frequency: flowData.frequency
      });

    if (error) {
      throw new Error(`Failed to create flow: ${error.message}`);
    }
  }

  static async deleteFlow(flowId: string, userId: string) {
    const { error } = await supabase
      .from('user_configurations')
      .delete()
      .eq('id', flowId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete flow: ${error.message}`);
    }
  }

  static async fetchUserFlows(userId: string) {
    const { data, error } = await supabase
      .from('user_configurations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch flows: ${error.message}`);
    }

    return data;
  }

  // Health check method for Apps Script endpoint
  static async checkAppsScriptHealth(): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke(this.EDGE_FUNCTION_NAME, {
        body: { action: "health_check" }
      });

      return !error && data?.success;
    } catch (error) {
      console.error('[FLOW SERVICE] Health check failed:', error);
      return false;
    }
  }
}
