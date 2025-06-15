
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const AuthStatus = () => {
  const { user, isGoogleConnected, refreshSession } = useAuth();
  
  if (!user) {
    return (
      <Link to="/auth">
        <Badge variant="destructive" className="flex items-center space-x-1">
          <AlertCircle className="w-3 h-3" />
          <span>Not signed in</span>
          <ExternalLink className="w-3 h-3" />
        </Badge>
      </Link>
    );
  }

  if (!isGoogleConnected) {
    return (
      <div className="flex items-center space-x-2">
        <Link to="/auth">
          <Badge variant="secondary" className="flex items-center space-x-1">
            <AlertCircle className="w-3 h-3" />
            <span>Google auth required</span>
            <ExternalLink className="w-3 h-3" />
          </Badge>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshSession}
          className="p-1 h-8 w-8"
          title="Refresh authentication"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Badge variant="secondary" className="flex items-center space-x-1 bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3" />
        <span>Google connected</span>
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        onClick={refreshSession}
        className="p-1 h-8 w-8"
        title="Refresh authentication"
      >
        <RefreshCw className="w-3 h-3" />
      </Button>
    </div>
  );
};

export default AuthStatus;
