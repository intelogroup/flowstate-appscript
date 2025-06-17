
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface FlowCreationFormProps {
  onSubmit: (flowData: any) => Promise<void>;
}

const FlowCreationForm = React.memo(({ onSubmit }: FlowCreationFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [flowData, setFlowData] = useState({
    flowName: '',
    senders: '',
    driveFolder: '',
    fileTypes: [] as string[],
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

  const validateForm = () => {
    if (!flowData.flowName.trim()) {
      setFormError('Flow name is required');
      return false;
    }
    if (!flowData.senders.trim()) {
      setFormError('At least one email sender is required');
      return false;
    }
    if (!flowData.driveFolder.trim()) {
      setFormError('Google Drive folder is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setFormError(null);

    try {
      // Convert senders to email filter format for backend compatibility
      const emailFilter = `from:(${flowData.senders}) has:attachment`;
      
      const submissionData = {
        ...flowData,
        emailFilter, // Backend expects emailFilter
        senders: flowData.senders // Keep original senders for display
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

  // Apps Script compatible frequency options
  const frequencyOptions = [
    { value: 'minute', label: 'Every minute' },
    { value: '5minutes', label: 'Every 5 minutes' },
    { value: '10minutes', label: 'Every 10 minutes' },
    { value: '15minutes', label: 'Every 15 minutes' },
    { value: '30minutes', label: 'Every 30 minutes' },
    { value: 'hourly', label: 'Every hour' },
    { value: '6hours', label: 'Every 6 hours' },
    { value: '12hours', label: 'Every 12 hours' },
    { value: 'daily', label: 'Daily' }
  ];

  const isFormValid = flowData.flowName.trim() && flowData.senders.trim() && flowData.driveFolder.trim();

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {formError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {/* Flow Name */}
      <div className="space-y-2">
        <Label htmlFor="flowName" className="text-sm font-medium">
          Flow Name *
        </Label>
        <Input
          id="flowName"
          placeholder="e.g., Invoice Attachments"
          value={flowData.flowName}
          onChange={(e) => updateFlowData('flowName', e.target.value)}
          className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        />
      </div>

      {/* Email Senders */}
      <div className="space-y-2">
        <Label htmlFor="senders" className="text-sm font-medium">
          Email Sender(s) *
        </Label>
        <Input
          id="senders"
          placeholder="e.g., invoices@company.com or invoices@company.com, billing@supplier.com"
          value={flowData.senders}
          onChange={(e) => updateFlowData('senders', e.target.value)}
          className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        />
        <p className="text-xs text-gray-500">
          Enter one or multiple email addresses separated by commas. We'll automatically look for emails with attachments.
        </p>
      </div>

      {/* Drive Folder */}
      <div className="space-y-2">
        <Label htmlFor="driveFolder" className="text-sm font-medium">
          Google Drive Folder *
        </Label>
        <Input
          id="driveFolder"
          placeholder="e.g., /Business/Invoices"
          value={flowData.driveFolder}
          onChange={(e) => updateFlowData('driveFolder', e.target.value)}
          className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        />
      </div>

      {/* File Types */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">File Types to Process</Label>
        <Select 
          onValueChange={(value) => updateFlowData('fileTypes', value === 'all' ? [] : [value])}
          disabled={isLoading}
        >
          <SelectTrigger className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <SelectValue placeholder="Select file types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All file types</SelectItem>
            <SelectItem value="pdf">PDF only</SelectItem>
            <SelectItem value="images">Images only</SelectItem>
            <SelectItem value="documents">Documents only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Auto Run Toggle */}
      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50/30">
        <div className="space-y-1">
          <Label className="text-sm font-medium">Auto-run Flow</Label>
          <p className="text-xs text-gray-500">
            Automatically process new emails at regular intervals
          </p>
        </div>
        <Switch
          checked={flowData.autoRun}
          onCheckedChange={(checked) => updateFlowData('autoRun', checked)}
          disabled={isLoading}
        />
      </div>

      {/* Frequency */}
      {flowData.autoRun && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Run Frequency</Label>
          <Select 
            value={flowData.frequency}
            onValueChange={(value) => updateFlowData('frequency', value)}
            disabled={isLoading}
          >
            <SelectTrigger className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {frequencyOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Submit Button */}
      <Button 
        onClick={handleSubmit}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 transition-all duration-200"
        size="lg"
        disabled={!isFormValid || isLoading}
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

FlowCreationForm.displayName = 'FlowCreationForm';

export default FlowCreationForm;
