
import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import React from 'react';

// Import the new components
import DebugPanel from './flow/DebugPanel';
import AuthStatusAlert from './flow/AuthStatusAlert';
import FlowCard from './flow/FlowCard';
import EmptyFlowsMessage from './flow/EmptyFlowsMessage';
import { useFlowOperations } from './flow/useFlowOperations';

interface UserFlow {
  id: string;
  flow_name: string;
  email_filter: string;
  drive_folder: string;
  file_types: string[];
  auto_run: boolean;
  frequency: string;
  created_at: string;
}

const FlowManager = React.memo(() => {
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const { toast } = useToast();
  const { user, session } = useAuth();

  const addDebugInfo = useCallback((message: string, isError: boolean = false) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    
    console.log(`[FLOW DEBUG] ${logMessage}`);
    setDebugInfo(prev => [...prev.slice(-19), logMessage]);
    
    toast({
      title: isError ? "🔴 Error Debug" : "🔍 Debug Info",
      description: message,
      variant: isError ? "destructive" : "default"
    });
  }, [toast]);

  const logSessionDetails = useCallback(() => {
    addDebugInfo("=== SESSION ANALYSIS START ===");
    
    if (!session) {
      addDebugInfo("❌ No session found", true);
      return;
    }

    addDebugInfo(`✅ Session exists - expires at: ${session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'UNKNOWN'}`);
    addDebugInfo(`👤 User ID: ${session.user?.id || 'MISSING'}`);
    addDebugInfo(`📧 User Email: ${session.user?.email || 'MISSING'}`);
    addDebugInfo(`🔗 Provider: ${session.user?.app_metadata?.provider || 'MISSING'}`);
    
    // Token analysis
    if (session.access_token) {
      addDebugInfo(`🔑 Access Token: PRESENT (${session.access_token.length} chars)`);
      addDebugInfo(`🔑 Token Preview: ${session.access_token.substring(0, 30)}...${session.access_token.substring(session.access_token.length - 10)}`);
      
      try {
        const tokenParts = session.access_token.split('.');
        addDebugInfo(`🔍 Token Structure: ${tokenParts.length} parts (${tokenParts.map(p => p.length).join(', ')} chars each)`);
      } catch (e) {
        addDebugInfo(`❌ Token analysis failed: ${e}`, true);
      }
    } else {
      addDebugInfo("❌ No access_token in session", true);
    }

    if (session.provider_token) {
      addDebugInfo(`🎫 Provider Token: PRESENT (${session.provider_token.length} chars)`);
    } else {
      addDebugInfo("⚠️ No provider_token in session");
    }

    if (session.refresh_token) {
      addDebugInfo(`🔄 Refresh Token: PRESENT (${session.refresh_token.length} chars)`);
    } else {
      addDebugInfo("⚠️ No refresh_token in session");
    }

    addDebugInfo("=== SESSION ANALYSIS END ===");
  }, [session, addDebugInfo]);

  // Use the custom hook for flow operations
  const { runningFlows, authError, runFlow, deleteFlow } = useFlowOperations(
    addDebugInfo, 
    logSessionDetails
  );

  // Fetch user's flows
  const { data: userFlows, isLoading, refetch } = useQuery({
    queryKey: ['user-flows', user?.id],
    queryFn: async () => {
      console.log('[FLOW DEBUG] Starting database query for user flows');
      
      try {
        const { data, error } = await supabase
          .from('user_configurations')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[FLOW DEBUG] Database error:', error.message);
          throw error;
        }

        console.log(`[FLOW DEBUG] Successfully fetched ${data?.length || 0} flows from database`);
        return data as UserFlow[];
      } catch (error) {
        console.error('[FLOW DEBUG] Database query failed:', error);
        throw error;
      }
    },
    enabled: !!user?.id,
  });

  // Check if user has Google authentication
  const hasGoogleAuth = useMemo(() => 
    session?.provider_token || session?.access_token, 
    [session?.provider_token, session?.access_token]
  );

  const handleDeleteFlow = useCallback(async (flowId: string) => {
    await deleteFlow(flowId);
    refetch();
  }, [deleteFlow, refetch]);

  const clearDebugInfo = useCallback(() => {
    setDebugInfo([]);
    toast({
      title: "🧹 Debug Info Cleared",
      description: "Debug information has been cleared.",
    });
  }, [toast]);

  const exportDebugInfo = useCallback(() => {
    const debugText = debugInfo.join('\n');
    const blob = new Blob([debugText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowstate-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "📁 Debug Log Exported",
      description: "Debug information has been saved to a file.",
    });
  }, [debugInfo, toast]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Flows</CardTitle>
          <CardDescription>Loading your Gmail to Drive flows...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="w-8 h-8 bg-blue-600 rounded-full animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Debug Information Panel */}
      <DebugPanel 
        debugInfo={debugInfo}
        onClear={clearDebugInfo}
        onExport={exportDebugInfo}
      />

      <Card>
        <CardHeader>
          <CardTitle>Your Flows</CardTitle>
          <CardDescription>Manage and execute your Gmail to Drive flows</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Authentication Status */}
          <AuthStatusAlert 
            hasGoogleAuth={hasGoogleAuth}
            authError={authError}
          />

          {!userFlows || userFlows.length === 0 ? (
            <EmptyFlowsMessage hasGoogleAuth={hasGoogleAuth} />
          ) : (
            userFlows.map((flow) => (
              <FlowCard
                key={flow.id}
                flow={flow}
                isRunning={runningFlows.has(flow.id)}
                hasGoogleAuth={hasGoogleAuth}
                onRun={runFlow}
                onDelete={handleDeleteFlow}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
});

FlowManager.displayName = 'FlowManager';

export default FlowManager;
