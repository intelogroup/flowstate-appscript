
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
  };
}

export class FlowService {
  private static readonly EDGE_FUNCTION_NAME = 'apps-script-proxy';

  static async executeFlow(
    flowId: string,
    userConfig: FlowConfig,
    googleTokens?: any
  ): Promise<FlowExecutionResult> {
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

      const { data, error } = await supabase.functions.invoke(this.EDGE_FUNCTION_NAME, {
        body: payload
      });

      if (error) {
        throw new Error(`Edge Function error: ${error.message}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Flow execution failed');
      }

      return {
        success: true,
        message: data.message || 'Flow executed successfully',
        data: data.apps_script_response?.data
      };
    } catch (error) {
      console.error('Flow execution error:', error);
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
}
