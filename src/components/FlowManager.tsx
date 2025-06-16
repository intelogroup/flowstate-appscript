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

  const addDebugInfo = (message: string, isError: boolean = false) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    
    console.log(`[FLOW DEBUG] ${logMessage}`);
    setDebugInfo(prev => [...prev.slice(-19), logMessage]);
    
    toast({
      title: isError ? "🔴 Error Debug" : "🔍 Debug Info",
      description: message,
      variant: isError ? "destructive" : "default"
    });
  };

  const logSessionDetails = () => {
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
  };

  // Fetch user's flows
  const { data: userFlows, isLoading, refetch } = useQuery({
    queryKey: ['user-flows', user?.id],
    queryFn: async () => {
      addDebugInfo("📊 Starting database query for user flows");
      
      try {
        const { data, error } = await supabase
          .from('user_configurations')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false });

        if (error) {
          addDebugInfo(`❌ Database error: ${error.message}`, true);
          throw error;
        }

        addDebugInfo(`✅ Successfully fetched ${data?.length || 0} flows from database`);
        return data as UserFlow[];
      } catch (error) {
        addDebugInfo(`💥 Database query failed: ${error}`, true);
        throw error;
      }
    },
    enabled: !!user?.id,
  });

  // Check if user has Google authentication
  const hasGoogleAuth = session?.provider_token || session?.access_token;

  const runFlow = async (flow: UserFlow) => {
    addDebugInfo(`🚀 === STARTING FLOW EXECUTION: ${flow.flow_name} ===`);
    setAuthError(null);
    setRunningFlows(prev => new Set(prev).add(flow.id));

    try {
      // Step 1: Session validation
      addDebugInfo("📋 Step 1: Session validation");
      if (!session) {
        const errorMsg = "No session found - user needs to sign in";
        addDebugInfo(`❌ ${errorMsg}`, true);
        setAuthError(errorMsg);
        toast({
          title: "🔴 Authentication Required",
          description: errorMsg,
          variant: "destructive"
        });
        return;
      }

      // Step 2: Detailed session logging
      addDebugInfo("📋 Step 2: Detailed session analysis");
      logSessionDetails();

      // Step 3: Token preparation
      addDebugInfo("📋 Step 3: Token preparation");
      const authToken = session.access_token;
      
      if (!authToken) {
        const errorMsg = "No access token in session - re-authentication required";
        addDebugInfo(`❌ ${errorMsg}`, true);
        setAuthError(errorMsg);
        toast({
          title: "🔴 Token Missing",
          description: errorMsg,
          variant: "destructive"
        });
        return;
      }

      addDebugInfo(`✅ Token ready: ${authToken.substring(0, 20)}...${authToken.substring(authToken.length - 10)} (${authToken.length} chars)`);

      // Step 4: Payload preparation
      addDebugInfo("📋 Step 4: Payload preparation");
      const basePayload = {
        action: 'run_flow',
        flowId: flow.id,
        access_token: authToken,
        debug_info: {
          timestamp: new Date().toISOString(),
          user_id: session.user?.id,
          user_email: session.user?.email,
          provider: session.user?.app_metadata?.provider,
          token_length: authToken.length,
          token_preview: authToken.substring(0, 20) + '...',
          flow_name: flow.flow_name,
          has_provider_token: !!session.provider_token,
          session_expires: session.expires_at,
          attempt_number: 1
        }
      };

      addDebugInfo(`📦 Payload prepared with ${Object.keys(basePayload).length} keys`);
      addDebugInfo(`🎯 Target flow: ${flow.flow_name} (ID: ${flow.id})`);

      // Step 5: Primary method attempt
      addDebugInfo("📋 Step 5: Primary method - supabase.functions.invoke");
      let response;
      let attemptMethod = "primary";
      
      try {
        addDebugInfo("🌐 Calling supabase.functions.invoke...");
        
        const invokeStartTime = performance.now();
        response = await supabase.functions.invoke('apps-script-proxy', {
          body: basePayload,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'X-Debug-Source': 'flowmanager-primary',
            'X-User-Agent': 'FlowState-WebApp/1.0'
          }
        });
        const invokeEndTime = performance.now();

        addDebugInfo(`⏱️ Primary method completed in ${Math.round(invokeEndTime - invokeStartTime)}ms`);
        addDebugInfo(`📊 Response status: ${response.error ? 'ERROR' : 'SUCCESS'}`);
        
        if (response.error) {
          addDebugInfo(`❌ Primary method error details:`, true);
          addDebugInfo(`  - Error: ${JSON.stringify(response.error)}`, true);
          addDebugInfo(`  - Error type: ${typeof response.error}`, true);
          addDebugInfo(`  - Error message: ${response.error.message || 'No message'}`, true);
        } else {
          addDebugInfo(`✅ Primary method success data:`);
          addDebugInfo(`  - Data keys: ${response.data ? Object.keys(response.data).join(', ') : 'No data'}`);
        }

      } catch (invokeError) {
        addDebugInfo(`💥 Primary method threw exception:`, true);
        addDebugInfo(`  - Error name: ${invokeError.name}`, true);
        addDebugInfo(`  - Error message: ${invokeError.message}`, true);
        addDebugInfo(`  - Error stack: ${invokeError.stack?.substring(0, 200)}...`, true);
        
        // Step 6: Fallback method
        addDebugInfo("📋 Step 6: Fallback method - direct fetch");
        attemptMethod = "fallback";
        
        try {
          const edgeFunctionUrl = `https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/apps-script-proxy`;
          addDebugInfo(`🌐 Fallback URL: ${edgeFunctionUrl}`);
          
          const fallbackPayload = {
            ...basePayload,
            debug_info: {
              ...basePayload.debug_info,
              fallback_attempt: true,
              primary_error: invokeError.message,
              method: 'direct_fetch',
              attempt_number: 2
            }
          };

          addDebugInfo("📤 Making direct fetch request...");
          const fetchStartTime = performance.now();
          
          const fetchResponse = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pa3Jvc25ya2d4bGJic2pkYmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjMwMzcsImV4cCI6MjA2NTU5OTAzN30.mrTrjtKDsS99v87pr64Gt1Rib6JU5V9gIfdly4bl9J0',
              'X-Debug-Source': 'flowmanager-fallback',
              'X-User-Agent': 'FlowState-WebApp/1.0'
            },
            body: JSON.stringify(fallbackPayload)
          });

          const fetchEndTime = performance.now();
          addDebugInfo(`⏱️ Fallback method completed in ${Math.round(fetchEndTime - fetchStartTime)}ms`);
          addDebugInfo(`📊 Fallback response status: ${fetchResponse.status} ${fetchResponse.statusText}`);
          
          const responseHeaders = Object.fromEntries(fetchResponse.headers.entries());
          addDebugInfo(`📋 Fallback response headers: ${JSON.stringify(responseHeaders)}`);

          let responseData;
          const responseText = await fetchResponse.text();
          addDebugInfo(`📄 Raw response length: ${responseText.length} chars`);
          
          try {
            responseData = JSON.parse(responseText);
            addDebugInfo(`✅ Successfully parsed JSON response`);
          } catch (jsonError) {
            addDebugInfo(`❌ Failed to parse JSON: ${jsonError.message}`, true);
            addDebugInfo(`📄 Response text preview: ${responseText.substring(0, 500)}...`, true);
            throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
          }

          response = {
            data: fetchResponse.ok ? responseData : null,
            error: fetchResponse.ok ? null : { 
              message: responseData.error || `HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`,
              status: fetchResponse.status,
              details: responseData
            }
          };

          addDebugInfo(`📊 Fallback method result: ${fetchResponse.ok ? 'SUCCESS' : 'ERROR'}`);

        } catch (fetchError) {
          addDebugInfo(`💥 Fallback method also failed:`, true);
          addDebugInfo(`  - Error name: ${fetchError.name}`, true);
          addDebugInfo(`  - Error message: ${fetchError.message}`, true);
          throw fetchError;
        }
      }

      // Step 7: Response analysis
      addDebugInfo(`📋 Step 7: Response analysis (${attemptMethod} method)`);
      addDebugInfo(`🔍 Response structure analysis:`);
      addDebugInfo(`  - Has error: ${!!response.error}`);
      addDebugInfo(`  - Has data: ${!!response.data}`);
      addDebugInfo(`  - Response type: ${typeof response}`);

      if (response.error) {
        addDebugInfo(`❌ === ERROR ANALYSIS ===`, true);
        const errorMessage = response.error.message || 'Unknown error';
        const errorStatus = response.error.status || 'Unknown status';
        
        addDebugInfo(`🔍 Error details:`, true);
        addDebugInfo(`  - Message: "${errorMessage}"`, true);
        addDebugInfo(`  - Status: ${errorStatus}`, true);
        addDebugInfo(`  - Full error: ${JSON.stringify(response.error)}`, true);
        
        // Enhanced error categorization
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid authentication token') || errorStatus === 401) {
          const authErrorMsg = "🔐 Google authentication has expired. Please sign in with Google again to refresh your permissions.";
          addDebugInfo(`🔐 Authentication error detected: ${authErrorMsg}`, true);
          setAuthError(authErrorMsg);
          toast({
            title: "🔴 Authentication Expired",
            description: authErrorMsg,
            variant: "destructive"
          });
          return;
        }
        
        if (errorMessage.includes('Google OAuth token not found') || errorMessage.includes('requiresGoogleAuth') || errorMessage.includes('Google OAuth required')) {
          const googleAuthMsg = "🔗 Google authentication is required. Please sign in with Google to access Gmail and Drive.";
          addDebugInfo(`🔗 Google OAuth error: ${googleAuthMsg}`, true);
          setAuthError(googleAuthMsg);
          toast({
            title: "🔴 Google Authentication Required",
            description: googleAuthMsg,
            variant: "destructive"
          });
          return;
        }

        if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('requiresPermissions') || errorStatus === 403) {
          const permissionMsg = "🚫 Google permissions denied. Please ensure you grant access to Gmail and Drive when signing in.";
          addDebugInfo(`🚫 Permission error: ${permissionMsg}`, true);
          setAuthError(permissionMsg);
          toast({
            title: "🔴 Permissions Required",
            description: permissionMsg,
            variant: "destructive"
          });
          return;
        }

        // Generic error handling
        addDebugInfo(`💥 Unhandled error category: ${errorMessage}`, true);
        toast({
          title: "🔴 Flow Execution Failed",
          description: `Error: ${errorMessage}`,
          variant: "destructive"
        });
        return;
      }

      // Step 8: Success handling
      addDebugInfo(`✅ === SUCCESS ANALYSIS ===`);
      addDebugInfo(`🎉 Flow execution completed successfully!`);
      addDebugInfo(`📊 Success data details:`);
      
      if (response.data) {
        addDebugInfo(`  - Data keys: ${Object.keys(response.data).join(', ')}`);
        addDebugInfo(`  - Data preview: ${JSON.stringify(response.data).substring(0, 200)}...`);
      }

      toast({
        title: "🎉 Flow Executed Successfully!",
        description: `${flow.flow_name} has been executed. Check your Google Drive folder for the saved attachments.`,
      });

      addDebugInfo(`🏁 === FLOW EXECUTION COMPLETED SUCCESSFULLY ===`);

    } catch (error) {
      addDebugInfo(`💥 === UNEXPECTED ERROR IN FLOW EXECUTION ===`, true);
      addDebugInfo(`🔍 Error analysis:`, true);
      addDebugInfo(`  - Error name: ${error.name}`, true);
      addDebugInfo(`  - Error message: ${error.message}`, true);
      addDebugInfo(`  - Error type: ${typeof error}`, true);
      addDebugInfo(`  - Error constructor: ${error.constructor.name}`, true);
      
      if (error.stack) {
        addDebugInfo(`  - Stack trace: ${error.stack.substring(0, 300)}...`, true);
      }
      
      console.error('🔴 Complete error object:', error);
      
      toast({
        title: "🔴 Unexpected Error",
        description: `An unexpected error occurred: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setRunningFlows(prev => {
        const newSet = new Set(prev);
        newSet.delete(flow.id);
        addDebugInfo(`🏁 Flow execution cleanup completed for: ${flow.flow_name}`);
        return newSet;
      });
    }
  };

  const deleteFlow = async (flowId: string) => {
    addDebugInfo(`🗑️ Starting flow deletion: ${flowId}`);
    
    try {
      const { error } = await supabase
        .from('user_configurations')
        .delete()
        .eq('id', flowId)
        .eq('user_id', user?.id);

      if (error) {
        addDebugInfo(`❌ Delete flow error: ${error.message}`, true);
        throw error;
      }

      addDebugInfo(`✅ Flow deleted successfully`);
      toast({
        title: "🗑️ Flow Deleted",
        description: "The flow has been successfully deleted.",
      });

      refetch();
    } catch (error) {
      addDebugInfo(`💥 Delete flow failed: ${error}`, true);
      console.error('Error deleting flow:', error);
      toast({
        title: "🔴 Error",
        description: "Failed to delete the flow.",
        variant: "destructive"
      });
    }
  };

  const clearDebugInfo = () => {
    setDebugInfo([]);
    toast({
      title: "🧹 Debug Info Cleared",
      description: "Debug information has been cleared.",
    });
  };

  const exportDebugInfo = () => {
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
  };

  if (isLoading) {
    addDebugInfo("⏳ Loading user flows...");
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
      {/* Enhanced Debug Information Panel */}
      {debugInfo.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center">
                <Bug className="w-5 h-5 mr-2 text-yellow-600" />
                Debug Information ({debugInfo.length}/20)
              </CardTitle>
              <div className="flex space-x-2">
                <Button 
                  onClick={exportDebugInfo} 
                  variant="outline" 
                  size="sm"
                  className="text-yellow-700 border-yellow-300"
                >
                  📁 Export
                </Button>
                <Button 
                  onClick={clearDebugInfo} 
                  variant="outline" 
                  size="sm"
                  className="text-yellow-700 border-yellow-300"
                >
                  🧹 Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {debugInfo.map((info, index) => (
                <div 
                  key={index} 
                  className={`text-xs font-mono p-2 rounded ${
                    info.includes('❌') || info.includes('💥') 
                      ? 'text-red-800 bg-red-100 border border-red-200' 
                      : info.includes('✅') || info.includes('🎉')
                      ? 'text-green-800 bg-green-100 border border-green-200'
                      : 'text-yellow-800 bg-yellow-100 border border-yellow-200'
                  }`}
                >
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
