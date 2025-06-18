
import { FlowFormData, FlowFormValidationResult } from './types';

export const validateFlowForm = (flowData: FlowFormData): FlowFormValidationResult => {
  if (!flowData.flowName.trim()) {
    return { isValid: false, error: 'Flow name is required' };
  }
  if (!flowData.senders.trim()) {
    return { isValid: false, error: 'At least one email sender is required' };
  }
  if (!flowData.driveFolder.trim()) {
    return { isValid: false, error: 'Google Drive folder is required' };
  }
  return { isValid: true, error: null };
};

export const isFormValid = (flowData: FlowFormData): boolean => {
  return !!(flowData.flowName.trim() && flowData.senders.trim() && flowData.driveFolder.trim());
};
