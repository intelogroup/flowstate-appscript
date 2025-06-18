
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type FlowExecutionLog = Database['public']['Tables']['flow_execution_logs']['Insert'];

export interface FlowExecutionLogData {
  flowId: string;
  userId: string;
  flowName: string;
  startedAt: string;
  completedAt?: string;
  success: boolean;
  attachmentsProcessed?: number;
  emailsFound?: number;
  emailsProcessed?: number;
  totalDurationMs?: number;
  appsScriptDurationMs?: number;
  errorMessage?: string;
  requestId?: string;
  version?: string;
  authMethod?: string;
  appsScriptResponse?: any;
}

export class FlowExecutionLogger {
  static async logExecution(data: FlowExecutionLogData): Promise<void> {
    try {
      console.log('[FLOW LOGGER] 📝 Saving execution log to database:', {
        flowId: data.flowId,
        userId: data.userId,
        flowName: data.flowName,
        success: data.success,
        duration: data.totalDurationMs,
        timestamp: new Date().toISOString()
      });

      const logEntry: FlowExecutionLog = {
        flow_id: data.flowId,
        user_id: data.userId,
        flow_name: data.flowName,
        started_at: data.startedAt,
        completed_at: data.completedAt || new Date().toISOString(),
        success: data.success,
        attachments_processed: data.attachmentsProcessed || 0,
        emails_found: data.emailsFound || 0,
        emails_processed: data.emailsProcessed || 0,
        total_duration_ms: data.totalDurationMs,
        apps_script_duration_ms: data.appsScriptDurationMs,
        error_message: data.errorMessage,
        request_id: data.requestId,
        version: data.version || 'v1.0',
        auth_method: data.authMethod || 'supabase',
        apps_script_response: data.appsScriptResponse
      };

      const { error } = await supabase
        .from('flow_execution_logs')
        .insert(logEntry);

      if (error) {
        console.error('[FLOW LOGGER] ❌ Failed to save execution log:', error);
      } else {
        console.log('[FLOW LOGGER] ✅ Execution log saved successfully');
      }
    } catch (error) {
      console.error('[FLOW LOGGER] 💥 Exception while saving execution log:', error);
    }
  }

  static async getRecentExecutions(userId: string, limit: number = 10) {
    try {
      const { data, error } = await supabase
        .from('flow_execution_logs')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[FLOW LOGGER] ❌ Failed to fetch execution logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[FLOW LOGGER] 💥 Exception while fetching execution logs:', error);
      return [];
    }
  }

  static async getFlowStats(userId: string, flowId?: string) {
    try {
      let query = supabase
        .from('flow_execution_logs')
        .select('success, total_duration_ms, attachments_processed, emails_processed')
        .eq('user_id', userId);

      if (flowId) {
        query = query.eq('flow_id', flowId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[FLOW LOGGER] ❌ Failed to fetch flow stats:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return {
          totalExecutions: 0,
          successfulExecutions: 0,
          successRate: 0,
          avgDuration: 0,
          totalAttachments: 0,
          totalEmailsProcessed: 0
        };
      }

      const totalExecutions = data.length;
      const successfulExecutions = data.filter(log => log.success).length;
      const successRate = (successfulExecutions / totalExecutions) * 100;
      const avgDuration = data
        .filter(log => log.total_duration_ms)
        .reduce((acc, log) => acc + (log.total_duration_ms || 0), 0) / totalExecutions;
      const totalAttachments = data.reduce((acc, log) => acc + (log.attachments_processed || 0), 0);
      const totalEmailsProcessed = data.reduce((acc, log) => acc + (log.emails_processed || 0), 0);

      return {
        totalExecutions,
        successfulExecutions,
        successRate: Math.round(successRate * 100) / 100,
        avgDuration: Math.round(avgDuration),
        totalAttachments,
        totalEmailsProcessed
      };
    } catch (error) {
      console.error('[FLOW LOGGER] 💥 Exception while fetching flow stats:', error);
      return null;
    }
  }
}
