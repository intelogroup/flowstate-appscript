
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import FlowManager from '@/components/FlowManager';
import AppHeader from '@/components/app/AppHeader';
import FlowFormCard from '@/components/app/FlowFormCard';
import { useFlowManagement } from '@/hooks/useFlowManagement';

const AppPage = () => {
  const { user, signOut } = useAuth();
  const { createFlow } = useFlowManagement();

  const handleFlowCreate = async (flowData: any) => {
    try {
      await createFlow(flowData);
    } catch (error) {
      console.error('Error creating flow:', error);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <AppHeader userEmail={user?.email} onLogout={handleLogout} />

      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          <FlowFormCard onFlowCreate={handleFlowCreate} />
          
          <div className="max-w-4xl mx-auto">
            <FlowManager />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AppPage;
