
import { FlowConfig } from '../types/flowTypes';

export class ConfigValidator {
  static validateConfig(userConfig: FlowConfig): void {
    console.log('[FLOW EXECUTION] 🔍 Validating configuration:', userConfig);
    
    if (!userConfig.userId) {
      throw new Error('User ID is required for flow execution');
    }
    if (!userConfig.driveFolder) {
      throw new Error('Drive folder is required for flow execution');
    }
    if (!userConfig.flowName) {
      throw new Error('Flow name is required for flow execution');
    }
    
    console.log('[FLOW EXECUTION] ✅ Configuration validation passed');
  }
}
