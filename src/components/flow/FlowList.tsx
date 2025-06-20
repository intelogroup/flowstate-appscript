
import React from 'react';
import FlowCard from './FlowCard';
import type { UserFlow } from '@/hooks/flow-execution/types';

interface FlowListProps {
  flows: UserFlow[];
  runningFlows: Set<string>;
  hasGoogleAuth: boolean;
  getCooldownInfo: (flowId: string) => { isOnCooldown: boolean; displayTime: string };
  onRun: (flow: UserFlow) => void;
  onDelete: (flowId: string) => void;
}

const FlowList = React.memo(({ 
  flows, 
  runningFlows, 
  hasGoogleAuth, 
  getCooldownInfo, 
  onRun, 
  onDelete 
}: FlowListProps) => {
  return (
    <div className="space-y-4">
      {flows.map((flow) => {
        const cooldownInfo = getCooldownInfo(flow.id);
        
        return (
          <FlowCard
            key={flow.id}
            flow={flow}
            isRunning={runningFlows.has(flow.id)}
            hasGoogleAuth={hasGoogleAuth}
            isOnCooldown={cooldownInfo.isOnCooldown}
            cooldownDisplay={cooldownInfo.displayTime}
            onRun={onRun}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
});

FlowList.displayName = 'FlowList';

export default FlowList;
