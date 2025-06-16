
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Play, Clock, CheckCircle, AlertCircle, ExternalLink, Bug } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

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

const FlowManager = () => {
  const [runningFlows, setRunningFlows] = useState<Set<string>>(new Set());
  const [authError, setAuthError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const { toast } = useToast();
  const { user, session } = useAuth();

  const addDebugInfo = (message: string) => {
    console.log(`[FLOW DEBUG] ${message}`);
    setDebugInfo(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
    
    toast({
      title: "Debug Info",
      description: message,
      variant: "default"
    });
  };

  // Fetch user's flows
  const { data: userFlows, isLoading, refetch } = useQuery({
    queryKey: ['user-flows', user?.id],
    queryFn: async () => {
      addDebugInfo("Fetching user flows from database");
      
      try {
        const { data, error } = await supabase
          .from('user_configurations')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false });

        if (error) {
          addDebugInfo(`Database error: ${error.message}`);
          throw error;
        }

        addDebugInfo(`Successfully fetched ${data?.length || 0} flows`);
        return data as UserFlow[];
      } catch (error) {
        addDebugInfo(`Failed to fetch flows: ${error}`);
        throw error;
      }
    },
    enabled: !!user?.id,
  });

  // Check if user has Google authentication
  const hasGoogleAuth = session?.provider_token || session?.access_token;

  const runFlow = async (flow: UserFlow) => {
    setAuthError(null);
    setRunningFlows(prev => new Set(prev).add(flow.id));
    addDebugInfo(`🚀 Starting flow execution: ${flow.flow_name}`);

    try {
      if (!session) {
        const errorMsg = "No session found - user needs to sign in";
        addDebugInfo(`❌ ${errorMsg}`);
        setAuthError(errorMsg);
        toast({
          title: "Authentication Required",
          description: errorMsg,
          variant: "destructive"
        });
        return;
      }

      // Enhanced session debugging
      addDebugInfo(`📊 Session Analysis:`);
      addDebugInfo(`  - User ID: ${session.user?.id || 'MISSING'}`);
      addDebugInfo(`  - User Email: ${session.user?.email || 'MISSING'}`);
      addDebugInfo(`  - Provider: ${session.user?.app_metadata?.provider || 'MISSING'}`);
      addDebugInfo(`  - Access Token Present: ${!!session.access_token}`);
      addDebugInfo(`  - Provider Token Present: ${!!session.provider_token}`);
      addDebugInfo(`  - Expires At: ${session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'MISSING'}`);

      if (session.access_token) {
        addDebugInfo(`  - Access Token Length: ${session.access_token.length}`);
        addDebugInfo(`  - Access Token Preview: ${session.access_token.substring(0, 50)}...`);
      }

      const authToken = session.access_token;
      
      if (!authToken) {
        const errorMsg = "No access token in session - re-authentication required";
        addDebugInfo(`❌ ${errorMsg}`);
        setAuthError(errorMsg);
        toast({
          title: "Token Missing",
          description: errorMsg,
          variant: "destructive"
        });
        return;
      }

      addDebugInfo(`🔑 Using token: ${authToken.substring(0, 20)}...${authToken.substring(authToken.length - 10)}`);
      addDebugInfo(`📤 Preparing to call edge function for flow: ${flow.flow_name}`);

      // Primary attempt with detailed error handling
      let response;
      let attemptMethod = "primary";
      
      try {
        addDebugInfo("🎯 Attempt 1: Using supabase.functions.invoke");
        
        const invokePayload = {
          action: 'run_flow',
          flowId: flow.id,
          access_token: authToken,
          debug_info: {
            user_id: session.user?.id,
            provider: session.user?.app_metadata?.provider,
            token_length: authToken.length
          }
        };

        addDebugInfo(`📦 Payload prepared: ${JSON.stringify(invokePayload, null, 2).substring(0, 200)}...`);

        response = await supabase.functions.invoke('apps-script-proxy', {
          body: invokePayload,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        addDebugInfo(`✅ Primary method response status: ${response.error ? 'ERROR' : 'SUCCESS'}`);
        
        if (response.error) {
          addDebugInfo(`❌ Primary method error: ${JSON.stringify(response.error)}`);
        } else {
          addDebugInfo(`✅ Primary method data: ${JSON.stringify(response.data)}`);
        }

      } catch (invokeError) {
        attemptMethod = "fallback";
        addDebugInfo(`❌ Primary method failed: ${invokeError}`);
        addDebugInfo("🔄 Switching to fallback method...");
        
        toast({
          title: "Primary Method Failed",
          description: `Switching to fallback: ${invokeError}`,
          variant: "destructive"
        });
        
        // Fallback: Direct fetch
        try {
          const edgeFunctionUrl = `https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/apps-script-proxy`;
          addDebugInfo(`🌐 Fallback URL: ${edgeFunctionUrl}`);
          
          const fetchPayload = {
            action: 'run_flow',
            flowId: flow.id,
            access_token: authToken,
            fallback_attempt: true,
            debug_info: {
              user_id: session.user?.id,
              provider: session.user?.app_metadata?.provider,
              method: 'direct_fetch'
            }
          };

          addDebugInfo(`📦 Fallback payload: ${JSON.stringify(fetchPayload, null, 2).substring(0, 200)}...`);

          const fetchResponse = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pa3Jvc25ya2d4bGJic2pkYmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjMwMzcsImV4cCI6MjA2NTU5OTAzN30.mrTrjtKDsS99v87pr64Gt1Rib6JU5V9gIfdly4bl9J0'
            },
            body: JSON.stringify(fetchPayload)
          });

          addDebugInfo(`🌐 Fallback response status: ${fetchResponse.status} ${fetchResponse.statusText}`);
          addDebugInfo(`🌐 Fallback response headers: ${JSON.stringify(Object.fromEntries(fetchResponse.headers.entries()))}`);

          let responseData;
          try {
            responseData = await fetchResponse.json();
            addDebugInfo(`📄 Fallback response data: ${JSON.stringify(responseData)}`);
          } catch (jsonError) {
            addDebugInfo(`❌ Failed to parse fallback response as JSON: ${jsonError}`);
            const textResponse = await fetchResponse.text();
            addDebugInfo(`📄 Fallback response text: ${textResponse}`);
            throw new Error(`Invalid JSON response: ${textResponse}`);
          }

          response = {
            data: fetchResponse.ok ? responseData : null,
            error: fetchResponse.ok ? null : { message: responseData.error || 'Unknown error' }
          };

        } catch (fetchError) {
          addDebugInfo(`❌ Fallback method also failed: ${fetchError}`);
          throw fetchError;
        }
      }

      addDebugInfo(`📊 Final response analysis (${attemptMethod} method):`);
      addDebugInfo(`  - Has Error: ${!!response.error}`);
      addDebugInfo(`  - Has Data: ${!!response.data}`);

      if (response.error) {
        addDebugInfo(`❌ Edge function error details: ${JSON.stringify(response.error)}`);
        
        // Enhanced error categorization
        const errorMessage = response.error.message || 'Unknown error';
        addDebugInfo(`🔍 Error message analysis: "${errorMessage}"`);
        
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid authentication token')) {
          const authErrorMsg = "Google authentication has expired. Please sign in with Google again to refresh your permissions.";
          addDebugInfo(`🔐 Authentication error detected: ${authErrorMsg}`);
          setAuthError(authErrorMsg);
          toast({
            title: "Authentication Expired",
            description: authErrorMsg,
            variant: "destructive"
          });
          return;
        }
        
        if (errorMessage.includes('Google OAuth token not found') || errorMessage.includes('requiresGoogleAuth')) {
          const googleAuthMsg = "Google authentication is required. Please sign in with Google to access Gmail and Drive.";
          addDebugInfo(`🔗 Google OAuth error: ${googleAuthMsg}`);
          setAuthError(googleAuthMsg);
          toast({
            title: "Google Authentication Required",
            description: googleAuthMsg,
            variant: "destructive"
          });
          return;
        }

        if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('requiresPermissions')) {
          const permissionMsg = "Google permissions denied. Please ensure you grant access to Gmail and Drive when signing in.";
          addDebugInfo(`🚫 Permission error: ${permissionMsg}`);
          setAuthError(permissionMsg);
          toast({
            title: "Permissions Required",
            description: permissionMsg,
            variant: "destructive"
          });
          return;
        }

        addDebugInfo(`💥 Generic error handling for: ${errorMessage}`);
        toast({
          title: "Flow Execution Failed",
          description: `Error: ${errorMessage}`,
          variant: "destructive"
        });
        return;
      }

      addDebugInfo(`✅ Flow execution successful!`);
      addDebugInfo(`📊 Success data: ${JSON.stringify(response.data)}`);

      toast({
        title: "🎉 Flow Executed Successfully!",
        description: `${flow.flow_name} has been executed. Check your Google Drive folder for the saved attachments.`,
      });

    } catch (error) {
      addDebugInfo(`💥 Unexpected error in flow execution: ${error}`);
      console.error('Complete error object:', error);
      
      toast({
        title: "Unexpected Error",
        description: `An unexpected error occurred: ${error}`,
        variant: "destructive"
      });
    } finally {
      setRunningFlows(prev => {
        const newSet = new Set(prev);
        newSet.delete(flow.id);
        addDebugInfo(`🏁 Flow execution completed for: ${flow.flow_name}`);
        return newSet;
      });
    }
  };

  const deleteFlow = async (flowId: string) => {
    addDebugInfo(`🗑️ Deleting flow: ${flowId}`);
    
    try {
      const { error } = await supabase
        .from('user_configurations')
        .delete()
        .eq('id', flowId)
        .eq('user_id', user?.id);

      if (error) {
        addDebugInfo(`❌ Delete flow error: ${error.message}`);
        throw error;
      }

      addDebugInfo(`✅ Flow deleted successfully`);
      toast({
        title: "Flow Deleted",
        description: "The flow has been successfully deleted.",
      });

      refetch();
    } catch (error) {
      addDebugInfo(`💥 Delete flow failed: ${error}`);
      console.error('Error deleting flow:', error);
      toast({
        title: "Error",
        description: "Failed to delete the flow.",
        variant: "destructive"
      });
    }
  };

  const clearDebugInfo = () => {
    setDebugInfo([]);
    toast({
      title: "Debug Info Cleared",
      description: "Debug information has been cleared.",
    });
  };

  if (isLoading) {
    addDebugInfo("Loading user flows...");
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
      {debugInfo.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center">
                <Bug className="w-5 h-5 mr-2 text-yellow-600" />
                Debug Information
              </CardTitle>
              <Button 
                onClick={clearDebugInfo} 
                variant="outline" 
                size="sm"
                className="text-yellow-700 border-yellow-300"
              >
                Clear Debug
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {debugInfo.map((info, index) => (
                <div key={index} className="text-sm font-mono text-yellow-800 bg-yellow-100 p-2 rounded">
                  {info}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Flows</CardTitle>
          <CardDescription>Manage and execute your Gmail to Drive flows</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Authentication Status */}
          {!hasGoogleAuth && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Google authentication required</p>
                  <p className="text-sm text-gray-600">Gmail and Drive access needed to run flows</p>
                </div>
                <Link to="/auth">
                  <Button size="sm" variant="outline">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Sign in with Google
                  </Button>
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {/* Authentication Error */}
          {authError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Authentication Issue</p>
                  <p className="text-sm">{authError}</p>
                </div>
                <Link to="/auth">
                  <Button size="sm" variant="outline">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Re-authenticate
                  </Button>
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {/* Success Status */}
          {hasGoogleAuth && !authError && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">✓ Connected to Google</p>
                    <p className="text-sm text-gray-600">Gmail and Drive access enabled</p>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {!userFlows || userFlows.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">Create your first flow using the form above to get started.</p>
              {!hasGoogleAuth && (
                <Link to="/auth">
                  <Button variant="outline">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Sign in with Google First
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            userFlows.map((flow) => (
              <div key={flow.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{flow.flow_name}</h3>
                  <div className="flex items-center space-x-2">
                    {flow.auto_run && (
                      <Badge variant="secondary" className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {flow.frequency}
                      </Badge>
                    )}
                    <Button
                      onClick={() => runFlow(flow)}
                      disabled={runningFlows.has(flow.id) || !hasGoogleAuth}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    >
                      {runningFlows.has(flow.id) ? (
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
                      onClick={() => deleteFlow(flow.id)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete
                    </Button>
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
                  <div>
                    <span className="font-medium">Created:</span>
                    <p>{new Date(flow.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FlowManager;
