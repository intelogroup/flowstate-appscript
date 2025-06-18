
import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';
import { FlowFormData } from './types';
import { isFormValid } from './FlowFormValidation';

interface FlowFormSubmissionProps {
  flowData: FlowFormData;
  isLoading: boolean;
  onSubmit: () => void;
}

const FlowFormSubmission = React.memo(({ flowData, isLoading, onSubmit }: FlowFormSubmissionProps) => {
  const formValid = isFormValid(flowData);

  return (
    <div className="space-y-4">
      {/* Submit Button */}
      <Button 
        onClick={onSubmit}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 transition-all duration-200"
        size="lg"
        disabled={!formValid || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Creating Flow...
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5 mr-2" />
            Create Flow
          </>
        )}
      </Button>

      <p className="text-center text-xs text-gray-500">
        Your flow will automatically save email attachments to Google Drive
      </p>
    </div>
  );
});

FlowFormSubmission.displayName = 'FlowFormSubmission';

export default FlowFormSubmission;
