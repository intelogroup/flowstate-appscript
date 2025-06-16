
import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { FlowService } from '@/services/flowService';

interface UseConnectivityCheckerProps {
  addLog: (message: string, isError?: boolean) => void;
}

export const useConnectivityChecker = ({ addLog }: UseConnectivityCheckerProps) => {
  const { toast } = useToast();

  const checkConnectivity = useCallback(async () => {
    addLog("🔍 Checking Apps Script connectivity...");
    try {
      const isHealthy = await FlowService.checkAppsScriptHealth();
      if (isHealthy) {
        addLog("✅ Apps Script connection is healthy");
        toast({
          title: "✅ Connection Healthy",
          description: "Apps Script endpoint is responding normally.",
        });
      } else {
        addLog("⚠️ Apps Script health check failed", true);
        toast({
          title: "⚠️ Connection Issues",
          description: "Apps Script endpoint may be experiencing issues.",
          variant: "destructive"
        });
      }
      return isHealthy;
    } catch (error) {
      addLog("❌ Health check error: " + (error instanceof Error ? error.message : 'Unknown error'), true);
      return false;
    }
  }, [addLog, toast]);

  return {
    checkConnectivity
  };
};
