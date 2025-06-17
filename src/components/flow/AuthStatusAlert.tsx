
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const AuthStatusAlert = React.memo(() => {
  const { user, isGoogleConnected, authError } = useAuth();

  // Authentication Error
  if (authError) {
    return (
      <Alert variant="destructive" className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <p className="font-medium">Connection Issue</p>
            <p className="text-sm text-red-700">Please sign in again to continue</p>
          </div>
          <Link to="/auth">
            <Button size="sm" variant="outline" className="bg-white hover:bg-red-50">
              <ExternalLink className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  // No Google Auth
  if (!user || !isGoogleConnected) {
    return (
      <Alert className="border-blue-200 bg-blue-50">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <p className="font-medium text-blue-900">Connect with Google</p>
            <p className="text-sm text-blue-700">
              Sign in with Google to create and run your automation flows
            </p>
          </div>
          <Link to="/auth">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <ExternalLink className="w-4 h-4 mr-2" />
              Connect Google
            </Button>
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  // Success Status - minimal and clean
  return (
    <Alert className="border-green-200 bg-green-50">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertDescription>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-green-900">Connected to Google</p>
            <p className="text-sm text-green-700">Ready to create and run flows</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
              <CheckCircle className="w-3 h-3 mr-1" />
              Active
            </span>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
});

AuthStatusAlert.displayName = 'AuthStatusAlert';

export default AuthStatusAlert;
