
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useFlowRetry = () => {
  const { forceTokenRefresh } = useAuth();
  const { toast } = useToast();

  const shouldRetry = (errorMessage: string, attemptNumber: number): boolean => {
    return (
      (errorMessage.includes('401') || 
       errorMessage.includes('Invalid auth_token') || 
       errorMessage.includes('Unauthorized')) && 
      attemptNumber === 1
    );
  };

  const handleRetry = async (
    errorMessage: string,
    attemptNumber: number,
    addLog: (message: string, isError?: boolean) => void
  ): Promise<boolean> => {
    if (!shouldRetry(errorMessage, attemptNumber)) {
      return false;
    }

    addLog(`🔄 Attempt ${attemptNumber} failed with auth error: ${errorMessage}`, true);
    addLog("🔄 Attempting token refresh and retry...", false);
    
    const refreshSuccess = await forceTokenRefresh();
    if (refreshSuccess) {
      addLog("✅ Token refresh successful, retrying flow execution...", false);
      return true;
    } else {
      addLog("❌ Token refresh failed, cannot retry", true);
      toast({
        title: "🔐 Authentication & Refresh Failed",
        description: "Please sign out and sign in again to get fresh Google OAuth tokens.",
        variant: "destructive"
      });
      return false;
    }
  };

  const handlePersistentError = (
    errorMessage: string,
    addLog: (message: string, isError?: boolean) => void
  ) => {
    if (errorMessage.includes('401') || errorMessage.includes('Invalid auth_token') || errorMessage.includes('authentication')) {
      addLog("🔧 Detected persistent authentication error after retry", true);
      addLog("💡 Recommendation: Sign out completely and sign in again to get fresh Google OAuth tokens", false);
      toast({
        title: "🔐 Persistent Authentication Error",
        description: "Please sign out and sign in again to refresh your Google OAuth tokens.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "🔴 Flow Execution Failed",
        description: errorMessage.length > 100 ? 
          errorMessage.substring(0, 100) + "..." : 
          errorMessage,
        variant: "destructive"
      });
    }
  };

  return { shouldRetry, handleRetry, handlePersistentError };
};
