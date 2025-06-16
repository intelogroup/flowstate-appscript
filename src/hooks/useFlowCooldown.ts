
import { useState, useCallback, useEffect } from 'react';

interface CooldownState {
  [flowId: string]: {
    isOnCooldown: boolean;
    remainingTime: number;
  };
}

export const useFlowCooldown = (cooldownDuration: number = 90000) => { // 1.5 minutes
  const [cooldowns, setCooldowns] = useState<CooldownState>({});

  const startCooldown = useCallback((flowId: string) => {
    setCooldowns(prev => ({
      ...prev,
      [flowId]: {
        isOnCooldown: true,
        remainingTime: cooldownDuration
      }
    }));

    // Update countdown every second
    const interval = setInterval(() => {
      setCooldowns(prev => {
        const current = prev[flowId];
        if (!current || current.remainingTime <= 1000) {
          clearInterval(interval);
          return {
            ...prev,
            [flowId]: {
              isOnCooldown: false,
              remainingTime: 0
            }
          };
        }

        return {
          ...prev,
          [flowId]: {
            ...current,
            remainingTime: current.remainingTime - 1000
          }
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownDuration]);

  const getCooldownInfo = useCallback((flowId: string) => {
    const cooldown = cooldowns[flowId];
    if (!cooldown || !cooldown.isOnCooldown) {
      return { isOnCooldown: false, remainingTime: 0, displayTime: '' };
    }

    const minutes = Math.floor(cooldown.remainingTime / 60000);
    const seconds = Math.floor((cooldown.remainingTime % 60000) / 1000);
    const displayTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    return {
      isOnCooldown: true,
      remainingTime: cooldown.remainingTime,
      displayTime
    };
  }, [cooldowns]);

  return {
    startCooldown,
    getCooldownInfo
  };
};
