
import React from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyFlowsMessageProps {
  hasGoogleAuth: boolean;
}

const EmptyFlowsMessage = React.memo(({ hasGoogleAuth }: EmptyFlowsMessageProps) => {
  return (
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
  );
});

EmptyFlowsMessage.displayName = 'EmptyFlowsMessage';

export default EmptyFlowsMessage;
