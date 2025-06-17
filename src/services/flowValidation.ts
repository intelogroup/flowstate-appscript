
import type { FlowConfig, FlowValidationResult } from './types/flowTypes';

export class FlowValidationService {
  static validateConfig(config: FlowConfig): FlowValidationResult {
    const errors: string[] = [];

    if (!config.userId?.trim()) {
      errors.push('User ID is required');
    }

    if (!config.driveFolder?.trim()) {
      errors.push('Drive folder is required');
    }

    if (!config.flowName?.trim()) {
      errors.push('Flow name is required');
    }

    if (!config.fileTypes || config.fileTypes.length === 0) {
      errors.push('At least one file type must be specified');
    }

    if (config.maxEmails && config.maxEmails < 1) {
      errors.push('Max emails must be greater than 0');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static sanitizeConfig(config: FlowConfig): FlowConfig {
    return {
      ...config,
      userId: config.userId?.trim(),
      driveFolder: config.driveFolder?.trim(),
      flowName: config.flowName?.trim(),
      senders: config.senders?.trim(),
      emailFilter: config.emailFilter?.trim(),
      fileTypes: config.fileTypes?.filter(type => type.trim().length > 0),
      maxEmails: Math.max(1, config.maxEmails || 10),
      enableDebugMode: config.enableDebugMode ?? true
    };
  }
}
