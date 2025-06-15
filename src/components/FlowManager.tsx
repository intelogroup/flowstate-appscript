
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

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
  const { toast } = useToast();
  const { user } = useAuth();

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

  const runFlow = async (flow: UserFlow) => {
    setRunningFlows(prev => new Set(prev).add(flow.id));

    try {
      const { data: session } = await supabase.auth.getSession();
      
      if (!session?.session) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to run flows.",
          variant: "destructive"
        });
        return;
      }

      console.log('Running flow:', flow.flow_name);

      const response = await supabase.functions.invoke('apps-script-proxy', {
        body: {
          action: 'run_flow',
          flowId: flow.id
        }
      });

      if (response.error) {
        console.error('Edge function error:', response.error);
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

  if (!userFlows || userFlows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Flows</CardTitle>
          <CardDescription>No flows created yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">
            Create your first flow using the form above to get started.
          </p>
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
        {userFlows.map((flow) => (
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
                  disabled={runningFlows.has(flow.id)}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
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
        ))}
      </CardContent>
    </Card>
  );
};

export default FlowManager;
