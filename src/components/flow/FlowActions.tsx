
import React from 'react';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

interface FlowActionsProps {
  flowId: string;
  flowName: string;
  isRunning: boolean;
  hasGoogleAuth: boolean;
  onRun: () => void;
  onDelete: () => void;
}

const FlowActions = React.memo(({ 
  flowId, 
  flowName, 
  isRunning, 
  hasGoogleAuth, 
  onRun, 
  onDelete 
}: FlowActionsProps) => {
  return (
    <div className="flex items-center space-x-2">
      <Button
        onClick={onRun}
        disabled={isRunning || !hasGoogleAuth}
        size="sm"
        className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
      >
        {isRunning ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            Running...
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            Run Flow
          </>
        )}
      </Button>
      <Button
        onClick={onDelete}
        variant="outline"
        size="sm"
        className="text-red-600 hover:text-red-700"
      >
        Delete
      </Button>
    </div>
  );
});

FlowActions.displayName = 'FlowActions';

export default FlowActions;
