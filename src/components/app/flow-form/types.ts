
export interface FlowFormData {
  flowName: string;
  senders: string;
  driveFolder: string;
  fileTypes: string[];
  autoRun: boolean;
  frequency: string;
}

export interface FlowCreationFormProps {
  onSubmit: (flowData: any) => Promise<void>;
}

export interface FlowFormFieldsProps {
  flowData: FlowFormData;
  updateFlowData: (field: string, value: any) => void;
  isLoading: boolean;
}

export interface FlowFormValidationResult {
  isValid: boolean;
  error: string | null;
}
