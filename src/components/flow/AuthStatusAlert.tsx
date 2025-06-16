
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const AuthStatusAlert = React.memo(() => {
  const { user, isGoogleConnected, authError, refreshSession } = useAuth();

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
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={refreshSession}
              className="whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Link to="/auth">
              <Button size="sm" variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                Re-authenticate
              </Button>
            </Link>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // No Google Auth
  if (!user || !isGoogleConnected) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <p className="font-medium">Google authentication required</p>
            <p className="text-sm text-gray-600">
              {!user 
                ? "Sign in and connect with Google to access Gmail and Drive" 
                : "Connect your Google account to access Gmail and Drive"
              }
            </p>
          </div>
          <Link to="/auth">
            <Button size="sm" variant="outline">
              <ExternalLink className="w-4 h-4 mr-2" />
              {!user ? "Sign in with Google" : "Connect Google"}
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
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Connected
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={refreshSession}
              className="p-2"
              title="Refresh authentication"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
});

AuthStatusAlert.displayName = 'AuthStatusAlert';

export default AuthStatusAlert;
