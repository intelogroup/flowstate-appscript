
import { FlowExecutionResult } from '../types/flowTypes';

export class ResultProcessor {
  static processResult(result: any): FlowExecutionResult {
    console.log('[FLOW EXECUTION] 📊 Processing result with enhanced tracking:', {
      hasResult: !!result,
      resultSuccess: result?.success,
      hasAppsScriptResponse: !!result?.apps_script_response,
      fullResult: result
    });

    const appsScriptData = result.apps_script_response || result;
    
    if (result.success && appsScriptData.status === 'success') {
      const successData = {
        attachments: appsScriptData.data?.attachments || 0,
        processedEmails: appsScriptData.data?.processedEmails || 0,
        emailsFound: appsScriptData.data?.emailsFound || 0
      };
      
      return {
        success: true,
        data: {
          ...successData,
          performance_metrics: result.performance_metrics,
          debugInfo: appsScriptData.data?.debugInfo || result.debug_info,
          rawResponse: result
        }
      };
    } else if (appsScriptData.status === 'error') {
      const errorMsg = appsScriptData.message || 'Apps Script execution failed';
      console.error('[FLOW EXECUTION] ❌ Apps Script error:', {
        status: appsScriptData.status,
        message: errorMsg,
        rawResponse: result
      });
      
      return {
        success: false,
        error: errorMsg,
        details: {
          appsScriptResponse: appsScriptData,
          rawResponse: result,
          timestamp: new Date().toISOString()
        }
      };
    } else {
      const errorMsg = result.error || appsScriptData.message || 'Unexpected result format';
      console.error('[FLOW EXECUTION] ❌ Unexpected result:', {
        resultSuccess: result.success,
        appsScriptStatus: appsScriptData.status,
        errorMessage: errorMsg,
        rawResponse: result
      });
      
      return {
        success: false,
        error: errorMsg,
        details: {
          unexpectedFormat: true,
          rawResponse: result,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}
