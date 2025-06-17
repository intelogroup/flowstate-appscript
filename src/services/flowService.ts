
import { supabase } from '@/integrations/supabase/client';
import { CreateFlowData, FlowConfig, FlowExecutionResult } from './types/flowTypes';
import { FlowExecutionService } from './flowExecution';

export class FlowService {
  static async executeFlow(
    flowId: string,
    userConfig: FlowConfig
  ): Promise<FlowExecutionResult> {
    return FlowExecutionService.executeFlow(flowId, userConfig);
  }

  static async fetchUserFlows(userId: string) {
    const { data, error } = await supabase
      .from('user_configurations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async createFlow(flowData: CreateFlowData) {
    const { data, error } = await supabase
      .from('user_configurations')
      .insert([{
        flow_name: flowData.flowName,
        email_filter: flowData.emailFilter,
        drive_folder: flowData.driveFolder,
        file_types: flowData.fileTypes,
        auto_run: flowData.autoRun,
        frequency: flowData.frequency,
        user_id: flowData.userId
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteFlow(flowId: string, userId: string) {
    const { error } = await supabase
      .from('user_configurations')
      .delete()
      .eq('id', flowId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  static async checkAppsScriptHealth(): Promise<boolean> {
    return FlowExecutionService.checkAppsScriptHealth();
  }
}

// Re-export types for backwards compatibility
export type { FlowConfig, FlowExecutionResult, CreateFlowData };
