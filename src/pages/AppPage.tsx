
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import FlowManager from '@/components/FlowManager';
import AppHeader from '@/components/app/AppHeader';
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <AppHeader userEmail={user?.email} onLogout={handleLogout} />

      <main className="container mx-auto px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Your Automation Hub
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Manage your Gmail-to-Drive workflows with ease. Create, monitor, and control your automation flows from one central dashboard.
            </p>
          </div>
          
          <FlowManager />
        </div>
      </main>
    </div>
  );
};

export default AppPage;
