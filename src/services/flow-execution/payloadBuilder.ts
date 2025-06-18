
import { FlowConfig } from '../types/flowTypes';

export class PayloadBuilder {
  private static readonly WEBHOOK_URL = 'https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/webhook-handler';

  static buildFlowPayload(flowId: string, userConfig: FlowConfig) {
    const payload = {
      action: 'process_gmail_flow',
      user_id: userConfig.userId,
      webhookUrl: this.WEBHOOK_URL,
      userConfig: {
        senders: userConfig.senders || userConfig.emailFilter,
        driveFolder: userConfig.driveFolder,
        fileTypes: userConfig.fileTypes || ['pdf'],
        flowName: userConfig.flowName,
        maxEmails: userConfig.maxEmails || 10,
        enableDebugMode: userConfig.enableDebugMode || true
      },
      debug_info: {
        request_id: `flow-${flowId}-${Date.now()}`,
        auth_method: 'shared-secret',
        request_source: 'flow-service-v2-webhook',
        flow_id: flowId,
        webhook_enabled: true
      }
    };
    
    console.log('[FLOW EXECUTION] 🔧 Built payload with webhook integration:', {
      ...payload,
      webhookUrl: this.WEBHOOK_URL,
      hasWebhookUrl: !!payload.webhookUrl
    });
    
    return payload;
  }

  static buildHealthCheckPayload() {
    return {
      action: 'health_check',
      user_id: 'health-check-user',
      webhookUrl: this.WEBHOOK_URL,
      userConfig: {
        flowName: 'Health Check',
        driveFolder: 'Health Check',
        fileTypes: ['pdf'],
        maxEmails: 1,
        enableDebugMode: true
      }
    };
  }
}
