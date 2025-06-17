
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, ArrowRight } from 'lucide-react';
import FlowCreationForm from './FlowCreationForm';

interface FlowFormCardProps {
  onFlowCreate: (flowData: any) => void;
}

const FlowFormCard = React.memo(({ onFlowCreate }: FlowFormCardProps) => {
  return (
    <div className="max-w-3xl mx-auto">
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-blue-50/30 backdrop-blur-sm">
        <CardHeader className="text-center pb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center space-x-2 px-4 py-2 bg-blue-100 rounded-full">
              <Zap className="w-5 h-5 text-blue-600" />
              <ArrowRight className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-700">Gmail to Drive</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Create Automation Flow
          </CardTitle>
          <CardDescription className="text-base text-gray-600 max-w-lg mx-auto">
            Set up an intelligent workflow to automatically save Gmail attachments to your Google Drive with custom filters and organization
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <FlowCreationForm onSubmit={onFlowCreate} />
        </CardContent>
      </Card>
    </div>
  );
});

FlowFormCard.displayName = 'FlowFormCard';

export default FlowFormCard;
