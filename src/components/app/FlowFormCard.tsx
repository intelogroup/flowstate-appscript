
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import FlowCreationForm from './FlowCreationForm';

interface FlowFormCardProps {
  onFlowCreate: (flowData: any) => void;
}

const FlowFormCard = React.memo(({ onFlowCreate }: FlowFormCardProps) => {
  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center">
            <Zap className="w-6 h-6 mr-2 text-blue-600" />
            Create New Flow
          </CardTitle>
          <CardDescription>
            Set up an automated workflow to save Gmail attachments to Google Drive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FlowCreationForm onSubmit={onFlowCreate} />
        </CardContent>
      </Card>
    </div>
  );
});

FlowFormCard.displayName = 'FlowFormCard';

export default FlowFormCard;
