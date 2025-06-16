import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Play, Clock, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
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
  const { toast } = useToast();
  const { user, session } = useAuth();

  // Fetch user's flows
  const { data: userFlows, isLoading, refetch } = useQuery({
    queryKey: ['user-flows', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_configurations')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as UserFlow[];
    },
    enabled: !!user?.id,
  });

  // Check if user has Google authentication
  const hasGoogleAuth = session?.provider_token || session?.access_token;

  const runFlow = async (flow: UserFlow) => {
    setAuthError(null);
    setRunningFlows(prev => new Set(prev).add(flow.id));

    try {
      if (!session) {
        setAuthError("Please sign in to run flows.");
        return;
      }

      // Enhanced debugging for session state
      console.log('=== FLOW EXECUTION DEBUG ===');
      console.log('Session object:', {
        access_token_present: !!session.access_token,
        provider_token_present: !!session.provider_token,
        user_id: session.user?.id,
        provider: session.user?.app_metadata?.provider,
        expires_at: session.expires_at
      });

      const authToken = session.access_token;
      
      if (!authToken) {
        setAuthError("No authentication token available. Please sign in again.");
        return;
      }

      console.log('Using auth token:', authToken.substring(0, 20) + '...');
      console.log('Running flow:', flow.flow_name);

      // Try the standard supabase.functions.invoke approach first
      let response;
      try {
        console.log('Attempting supabase.functions.invoke...');
        response = await supabase.functions.invoke('apps-script-proxy', {
          body: {
            action: 'run_flow',
            flowId: flow.id,
            // Also pass token in body as fallback
            access_token: authToken
          },
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (invokeError) {
        console.error('supabase.functions.invoke failed:', invokeError);
        
        // Fallback: Direct fetch to the edge function
        console.log('Attempting direct fetch fallback...');
        const edgeFunctionUrl = `https://mikrosnrkgxlbbsjdbjn.supabase.co/functions/v1/apps-script-proxy`;
        
        const fetchResponse = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pa3Jvc25ya2d4bGJic2pkYmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjMwMzcsImV4cCI6MjA2NTU5OTAzN30.mrTrjtKDsS99v87pr64Gt1Rib6JU5V9gIfdly4bl9J0'
          },
          body: JSON.stringify({
            action: 'run_flow',
            flowId: flow.id,
            access_token: authToken
          })
        });

        const responseData = await fetchResponse.json();
        response = {
          data: fetchResponse.ok ? responseData : null,
          error: fetchResponse.ok ? null : { message: responseData.error || 'Unknown error' }
        };
      }

      console.log('Edge function response:', response);

      if (response.error) {
        console.error('Edge function error:', response.error);
        
        // Handle specific error types
        if (response.error.message?.includes('401') || response.error.message?.includes('Unauthorized')) {
          setAuthError("Your Google authentication has expired. Please sign in with Google again to refresh your permissions.");
          return;
        }
        
        if (response.error.message?.includes('Google OAuth token not found')) {
          setAuthError("Google authentication is required. Please sign in with Google to access Gmail and Drive.");
          return;
        }

        if (response.error.message?.includes('403') || response.error.message?.includes('Forbidden')) {
          setAuthError("Google permissions denied. Please ensure you grant access to Gmail and Drive when signing in.");
          return;
        }

        toast({
          title: "Flow Execution Failed",
          description: response.error.message || "Failed to execute the flow",
          variant: "destructive"
        });
        return;
      }

      console.log('Flow execution result:', response.data);

      toast({
        title: "Flow Executed Successfully!",
        description: `${flow.flow_name} has been executed. Check your Google Drive folder.`,
      });

    } catch (error) {
      console.error('Error running flow:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while running the flow.",
        variant: "destructive"
      });
    } finally {
      setRunningFlows(prev => {
        const newSet = new Set(prev);
        newSet.delete(flow.id);
        return newSet;
      });
    }
  };

  const deleteFlow = async (flowId: string) => {
    try {
      const { error } = await supabase
        .from('user_configurations')
        .delete()
        .eq('id', flowId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: "Flow Deleted",
        description: "The flow has been successfully deleted.",
      });

      refetch();
    } catch (error) {
      console.error('Error deleting flow:', error);
      toast({
        title: "Error",
        description: "Failed to delete the flow.",
        variant: "destructive"
      });
    }
  };

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
  );
};

export default FlowManager;
