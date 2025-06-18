
import { FlowConfig, FlowExecutionResult } from './types/flowTypes';
import { FlowExecutionLogger } from './flowExecutionLogger';
import { ConfigValidator } from './flow-execution/configValidator';
import { PayloadBuilder } from './flow-execution/payloadBuilder';
import { NetworkClient } from './flow-execution/networkClient';
import { ResultProcessor } from './flow-execution/resultProcessor';
import { HealthChecker } from './flow-execution/healthChecker';

export class FlowExecutionService {
  static async executeFlow(
    flowId: string,
    userConfig: FlowConfig
  ): Promise<FlowExecutionResult> {
    const startTime = Date.now();
    const startedAt = new Date().toISOString();
    
    try {
      console.log('[FLOW EXECUTION] 🚀 Starting flow execution with enhanced error tracking and logging:', {
        flowId,
        userId: userConfig.userId,
        flowName: userConfig.flowName,
        timestamp: startedAt
      });
      
      ConfigValidator.validateConfig(userConfig);
      const payload = PayloadBuilder.buildFlowPayload(flowId, userConfig);
      const response = await NetworkClient.makeAuthenticatedRequest(payload);
      const result = await NetworkClient.processResponse(response);
      const processedResult = ResultProcessor.processResult(result);
      
      // Log the execution (success or failure)
      const totalDuration = Date.now() - startTime;
      await FlowExecutionLogger.logExecution({
        flowId,
        userId: userConfig.userId,
        flowName: userConfig.flowName,
        startedAt,
        completedAt: new Date().toISOString(),
        success: processedResult.success,
        attachmentsProcessed: processedResult.data?.attachments,
        emailsFound: processedResult.data?.emailsFound,
        emailsProcessed: processedResult.data?.processedEmails,
        totalDurationMs: totalDuration,
        appsScriptDurationMs: processedResult.data?.performance_metrics?.total_duration,
        errorMessage: processedResult.error,
        requestId: payload.debug_info?.request_id,
        authMethod: 'supabase',
        appsScriptResponse: result
      });
      
      return processedResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      console.error('[FLOW EXECUTION] 💥 Flow execution failed:', {
        error: errorMsg,
        flowId,
        userId: userConfig.userId,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
      
      // Log the failed execution if not already logged
      await FlowExecutionLogger.logExecution({
        flowId,
        userId: userConfig.userId,
        flowName: userConfig.flowName,
        startedAt,
        completedAt: new Date().toISOString(),
        success: false,
        errorMessage: errorMsg,
        totalDurationMs: duration,
        authMethod: 'supabase'
      });
      
      return {
        success: false,
        error: errorMsg,
        details: {
          duration,
          flowId,
          userId: userConfig.userId,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  static async checkAppsScriptHealth(): Promise<boolean> {
    return HealthChecker.checkAppsScriptHealth();
  }
}
