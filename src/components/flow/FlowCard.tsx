
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import FlowActions from './FlowActions';

interface UserFlow {
  id: string;
  flow_name: string;
  email_filter: string;
  drive_folder: string;
  file_types: string[];
  auto_run: boolean;
  frequency: string;
  created_at: string;
  older_than_minutes?: number;
}

interface FlowCardProps {
  flow: UserFlow;
  isRunning: boolean;
  hasGoogleAuth: boolean;
  onRun: (flow: UserFlow) => void;
  onDelete: (flowId: string) => void;
}

const FlowCard = React.memo(({ flow, isRunning, hasGoogleAuth, onRun, onDelete }: FlowCardProps) => {
  const handleRun = React.useCallback(() => {
    onRun(flow);
  }, [flow, onRun]);

  const handleDelete = React.useCallback(() => {
    onDelete(flow.id);
  }, [flow.id, onDelete]);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{flow.flow_name}</h3>
        <div className="flex items-center space-x-2">
          {flow.auto_run && (
            <Badge variant="secondary" className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {flow.frequency}
            </Badge>
          )}
          <FlowActions
            flowId={flow.id}
            flowName={flow.flow_name}
            isRunning={isRunning}
            hasGoogleAuth={hasGoogleAuth}
            onRun={handleRun}
            onDelete={handleDelete}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
        <div>
          <span className="font-medium">Email Filter:</span>
          <p className="break-all">{flow.email_filter}</p>
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
        {flow.older_than_minutes && (
          <div>
            <span className="font-medium">Time Filter:</span>
            <p>Emails older than {flow.older_than_minutes} minutes</p>
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
