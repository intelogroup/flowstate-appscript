
import { useCallback } from 'react';

interface UseConnectivityCheckerProps {
  addLog: (message: string, isError?: boolean) => void;
}

export const useConnectivityChecker = ({ addLog }: UseConnectivityCheckerProps) => {
  const checkConnectivity = useCallback(async (): Promise<void> => {
    try {
      addLog("🔍 Checking connectivity to Apps Script...", false);
      
      const response = await fetch('/api/health-check', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        addLog("✅ Connectivity check successful", false);
      } else {
        addLog(`⚠️ Connectivity check failed: ${response.status}`, true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Connectivity check error: ${errorMessage}`, true);
    }
  }, [addLog]);

  return { checkConnectivity };
};
