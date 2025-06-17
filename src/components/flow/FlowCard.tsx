
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import FlowActions from './FlowActions';
import type { UserFlow } from '@/hooks/flow-execution/types';

interface FlowCardProps {
  flow: UserFlow;
  isRunning: boolean;
  hasGoogleAuth: boolean;
  isOnCooldown: boolean;
  cooldownDisplay: string;
  onRun: (flow: UserFlow) => void;
  onDelete: (flowId: string) => void;
}

const FlowCard = React.memo(({ 
  flow, 
  isRunning, 
  hasGoogleAuth, 
  isOnCooldown,
  cooldownDisplay,
  onRun, 
  onDelete 
}: FlowCardProps) => {
  const handleRun = React.useCallback(() => {
    onRun(flow);
  }, [flow, onRun]);

  const handleDelete = React.useCallback(() => {
    onDelete(flow.id);
  }, [flow.id, onDelete]);

  const displaySenders = flow.senders || 
    (flow.email_filter?.match(/from:\((.*?)\)/)?.[1] || 
     flow.email_filter?.replace(/has:attachment/g, '').trim());

  const getFrequencyLabel = (freq: string) => {
    const frequencyMap: Record<string, string> = {
      'minute': 'Every minute',
      '5minutes': 'Every 5 minutes',
      '10minutes': 'Every 10 minutes', 
      '15minutes': 'Every 15 minutes',
      '30minutes': 'Every 30 minutes',
      'hourly': 'Every hour',
      '6hours': 'Every 6 hours',
      '12hours': 'Every 12 hours',
      'daily': 'Daily',
      'weekly': 'Weekly'
    };
    return frequencyMap[freq] || freq;
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{flow.flow_name}</h3>
        <div className="flex items-center space-x-2">
          {flow.auto_run && (
            <Badge variant="secondary" className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {getFrequencyLabel(flow.frequency)}
            </Badge>
          )}
          <FlowActions
            flowId={flow.id}
            flowName={flow.flow_name}
            isRunning={isRunning}
            hasGoogleAuth={hasGoogleAuth}
            isOnCooldown={isOnCooldown}
            cooldownDisplay={cooldownDisplay}
            onRun={handleRun}
            onDelete={handleDelete}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
        <div>
          <span className="font-medium">Email Senders:</span>
          <p className="break-all">{displaySenders || 'Not specified'}</p>
        </div>
        <div>
          <span className="font-medium">Drive Folder:</span>
          <p className="break-all">{flow.drive_folder}</p>
        </div>
        {flow.file_types && flow.file_types.length > 0 && (
          <div>
            <span className="font-medium">File Types:</span>
            <p>{flow.file_types.join(', ')}</p>
          </div>
        )}
        <div>
          <span className="font-medium">Created:</span>
          <p>{new Date(flow.created_at).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
});

FlowCard.displayName = 'FlowCard';

export default FlowCard;
