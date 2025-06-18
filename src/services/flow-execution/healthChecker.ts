
import { PayloadBuilder } from './payloadBuilder';

export class HealthChecker {
  private static readonly EDGE_FUNCTION_URL = 'https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/apps-script-proxy';

  static async checkAppsScriptHealth(): Promise<boolean> {
    try {
      console.log('[FLOW EXECUTION] 🏥 Starting Apps Script health check with webhook support...');
      
      const payload = PayloadBuilder.buildHealthCheckPayload();

      const response = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('[FLOW EXECUTION] 🏥 Health check response with webhook integration:', {
        status: response.status,
        ok: response.ok,
        webhookEnabled: true
      });
      
      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      const isHealthy = result.success === true;
      console.log('[FLOW EXECUTION] 🏥 Health check conclusion with webhook support:', isHealthy ? 'HEALTHY' : 'UNHEALTHY');
      
      return isHealthy;

    } catch (error) {
      console.error('[FLOW EXECUTION] 🏥 Health check exception:', {
        error: error instanceof Error ? error.message : String(error),
        webhookEnabled: true
      });
      return false;
    }
  }
}
