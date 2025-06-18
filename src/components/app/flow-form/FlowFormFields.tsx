
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FlowFormFieldsProps } from './types';

const FlowFormFields = React.memo(({ flowData, updateFlowData, isLoading }: FlowFormFieldsProps) => {
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

  return (
    <>
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
          placeholder="e.g., jayveedz19@gmail.com or invoices@company.com, billing@supplier.com"
          value={flowData.senders}
          onChange={(e) => updateFlowData('senders', e.target.value)}
          className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        />
        <p className="text-xs text-gray-500">
          Enter one or multiple email addresses separated by commas. We'll automatically search for emails with attachments from these senders.
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
    </>
  );
});

FlowFormFields.displayName = 'FlowFormFields';

export default FlowFormFields;
