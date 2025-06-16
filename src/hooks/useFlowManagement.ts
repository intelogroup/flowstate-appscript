
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { FlowService } from '@/services/flowService';

export const useFlowManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: userFlows, isLoading, refetch } = useQuery({
    queryKey: ['user-flows', user?.id],
    queryFn: () => FlowService.fetchUserFlows(user?.id!),
    enabled: !!user?.id,
  });

  const createFlow = useCallback(async (flowData: {
    flowName: string;
    emailFilter: string;
    driveFolder: string;
    fileTypes: string[];
    autoRun: boolean;
    frequency: string;
  }) => {
    if (!user?.id) {
      throw new Error('User authentication required');
    }

    try {
      await FlowService.createFlow({
        ...flowData,
        userId: user.id
      });

      toast({
        title: "✅ Flow Created Successfully!",
        description: `${flowData.flowName} is now active and ready to process Gmail attachments.`,
      });

      // Invalidate and refetch flows
      queryClient.invalidateQueries({ queryKey: ['user-flows', user.id] });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create flow';
      toast({
        title: "🔴 Error Creating Flow",
        description: errorMessage,
        variant: "destructive"
      });
      throw error;
    }
  }, [user?.id, toast, queryClient]);

  const deleteFlow = useCallback(async (flowId: string) => {
    if (!user?.id) {
      throw new Error('User authentication required');
    }

    try {
      await FlowService.deleteFlow(flowId, user.id);
      
      toast({
        title: "🗑️ Flow Deleted",
        description: "The flow has been successfully deleted.",
      });

      // Invalidate and refetch flows
      queryClient.invalidateQueries({ queryKey: ['user-flows', user.id] });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete flow';
      toast({
        title: "🔴 Error Deleting Flow",
        description: errorMessage,
        variant: "destructive"
      });
      throw error;
    }
  }, [user?.id, toast, queryClient]);

  return {
    userFlows,
    isLoading,
    createFlow,
    deleteFlow,
    refetch
  };
};
