
import React, { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { FlowCreationFormProps, FlowFormData } from './flow-form/types';
import { validateFlowForm } from './flow-form/FlowFormValidation';
import FlowFormFields from './flow-form/FlowFormFields';
import FlowFormSubmission from './flow-form/FlowFormSubmission';

const FlowCreationForm = React.memo(({ onSubmit }: FlowCreationFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [flowData, setFlowData] = useState<FlowFormData>({
    flowName: '',
    senders: '',
    driveFolder: '',
    fileTypes: [],
    autoRun: false,
    frequency: 'daily'
  });

  const updateFlowData = (field: string, value: any) => {
    setFlowData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user starts typing
    if (formError) setFormError(null);
  };

  const handleSubmit = async () => {
    const validation = validateFlowForm(flowData);
    if (!validation.isValid) {
      setFormError(validation.error);
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      // Send the raw senders data - let Apps Script format the Gmail query
      const submissionData = {
        ...flowData,
        senders: flowData.senders.trim() // Just pass the raw email addresses
      };

      await onSubmit(submissionData);
      
      // Reset form on successful submission
      setFlowData({
        flowName: '',
        senders: '',
        driveFolder: '',
        fileTypes: [],
        autoRun: false,
        frequency: 'daily'
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create flow');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {formError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <FlowFormFields
        flowData={flowData}
        updateFlowData={updateFlowData}
        isLoading={isLoading}
      />

      <FlowFormSubmission
        flowData={flowData}
        isLoading={isLoading}
        onSubmit={handleSubmit}
      />
    </div>
  );
});

FlowCreationForm.displayName = 'FlowCreationForm';

export default FlowCreationForm;
