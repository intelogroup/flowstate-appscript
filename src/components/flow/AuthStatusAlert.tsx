
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AuthStatusAlertProps {
  hasGoogleAuth: boolean;
  authError: string | null;
}

const AuthStatusAlert = React.memo(({ hasGoogleAuth, authError }: AuthStatusAlertProps) => {
  // Authentication Error
  if (authError) {
    return (
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
    );
  }

  // No Google Auth
  if (!hasGoogleAuth) {
    return (
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
    );
  }

  // Success Status
  return (
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
  );
});

AuthStatusAlert.displayName = 'AuthStatusAlert';

export default AuthStatusAlert;
