
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { CheckCircle } from 'lucide-react';

interface FlowCreationFormProps {
  onSubmit: (flowData: any) => void;
}

const FlowCreationForm = React.memo(({ onSubmit }: FlowCreationFormProps) => {
  const [flowData, setFlowData] = useState({
    flowName: '',
    emailFilter: '',
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
  };

  const handleSubmit = async () => {
    if (!flowData.flowName || !flowData.emailFilter || !flowData.driveFolder) {
      return;
    }

    await onSubmit(flowData);
    
    // Reset form
    setFlowData({
      flowName: '',
      emailFilter: '',
      driveFolder: '',
      fileTypes: [],
      autoRun: false,
      frequency: 'daily'
    });
  };

  return (
    <div className="space-y-6">
      {/* Flow Name */}
      <div className="space-y-2">
        <Label htmlFor="flowName">Flow Name *</Label>
        <Input
          id="flowName"
          placeholder="e.g., Invoice Attachments"
          value={flowData.flowName}
          onChange={(e) => updateFlowData('flowName', e.target.value)}
          className="border-gray-200 focus:border-blue-500"
        />
      </div>

      {/* Email Filter */}
      <div className="space-y-2">
        <Label htmlFor="emailFilter">Email Filter *</Label>
        <Textarea
          id="emailFilter"
          placeholder="e.g., from:invoices@company.com has:attachment"
          value={flowData.emailFilter}
          onChange={(e) => updateFlowData('emailFilter', e.target.value)}
          className="border-gray-200 focus:border-blue-500 resize-none"
          rows={3}
        />
        <p className="text-sm text-gray-500">
          Use Gmail search syntax to define which emails to process (from the last hour)
        </p>
      </div>

      {/* Drive Folder */}
      <div className="space-y-2">
        <Label htmlFor="driveFolder">Google Drive Folder *</Label>
        <Input
          id="driveFolder"
          placeholder="e.g., /Business/Invoices"
          value={flowData.driveFolder}
          onChange={(e) => updateFlowData('driveFolder', e.target.value)}
          className="border-gray-200 focus:border-blue-500"
        />
      </div>

      {/* File Types */}
      <div className="space-y-2">
        <Label>File Types to Process</Label>
        <Select onValueChange={(value) => updateFlowData('fileTypes', value === 'all' ? [] : [value])}>
          <SelectTrigger className="border-gray-200 focus:border-blue-500">
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
      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
        <div className="space-y-1">
          <Label>Auto-run Flow</Label>
          <p className="text-sm text-gray-500">
            Automatically process new emails from the last hour
          </p>
        </div>
        <Switch
          checked={flowData.autoRun}
          onCheckedChange={(checked) => updateFlowData('autoRun', checked)}
        />
      </div>

      {/* Frequency */}
      {flowData.autoRun && (
        <div className="space-y-2">
          <Label>Run Frequency</Label>
          <Select 
            value={flowData.frequency}
            onValueChange={(value) => updateFlowData('frequency', value)}
          >
            <SelectTrigger className="border-gray-200 focus:border-blue-500">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Every hour</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Set Flow Button */}
      <Button 
        onClick={handleSubmit}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3"
        size="lg"
        disabled={!flowData.flowName || !flowData.emailFilter || !flowData.driveFolder}
      >
        <CheckCircle className="w-5 h-5 mr-2" />
        Set Flow
      </Button>

      <p className="text-center text-sm text-gray-500">
        Your flow will process emails from the last hour automatically
      </p>
    </div>
  );
});

FlowCreationForm.displayName = 'FlowCreationForm';

export default FlowCreationForm;
