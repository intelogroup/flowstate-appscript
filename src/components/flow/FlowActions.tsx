
import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Clock } from 'lucide-react';

interface FlowActionsProps {
  flowId: string;
  flowName: string;
  isRunning: boolean;
  hasGoogleAuth: boolean;
  isOnCooldown: boolean;
  cooldownDisplay: string;
  onRun: () => void;
  onDelete: () => void;
}

const FlowActions = React.memo(({ 
  flowId, 
  flowName, 
  isRunning, 
  hasGoogleAuth, 
  isOnCooldown,
  cooldownDisplay,
  onRun, 
  onDelete 
}: FlowActionsProps) => {
  const isDisabled = isRunning || !hasGoogleAuth || isOnCooldown;

  const getButtonContent = () => {
    if (isRunning) {
      return (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
          Running...
        </>
      );
    }
    
    if (isOnCooldown) {
      return (
        <>
          <Clock className="w-4 h-4 mr-2" />
          Available in {cooldownDisplay}
        </>
      );
    }
    
    return (
      <>
        <Play className="w-4 h-4 mr-2" />
        Run Flow
      </>
    );
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        onClick={onRun}
        disabled={isDisabled}
        size="sm"
        className={`${
          isOnCooldown 
            ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed' 
            : 'bg-green-600 hover:bg-green-700'
        } disabled:opacity-50`}
      >
        {getButtonContent()}
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
