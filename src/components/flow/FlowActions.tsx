
import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Clock, Loader2 } from 'lucide-react';

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
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

  const getButtonVariant = () => {
    if (isOnCooldown) return 'secondary';
    if (isRunning) return 'default';
    return 'default';
  };

  const getButtonClass = () => {
    if (isOnCooldown) return 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed text-white';
    if (isRunning) return 'bg-blue-600 hover:bg-blue-600 cursor-not-allowed';
    return 'bg-green-600 hover:bg-green-700';
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        onClick={onRun}
        disabled={isDisabled}
        size="sm"
        variant={getButtonVariant()}
        className={getButtonClass()}
      >
        {getButtonContent()}
      </Button>
      <Button
        onClick={onDelete}
        variant="outline"
        size="sm"
        className="text-red-600 hover:text-red-700"
        disabled={isRunning}
      >
        Delete
      </Button>
    </div>
  );
});

FlowActions.displayName = 'FlowActions';

export default FlowActions;
