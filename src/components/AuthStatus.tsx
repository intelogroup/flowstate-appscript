
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const AuthStatus = () => {
  const { user, session } = useAuth();
  
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

  const hasGoogleAuth = session?.provider_token;

  if (!hasGoogleAuth) {
    return (
      <Link to="/auth">
        <Badge variant="secondary" className="flex items-center space-x-1">
          <AlertCircle className="w-3 h-3" />
          <span>Google auth required</span>
          <ExternalLink className="w-3 h-3" />
        </Badge>
      </Link>
    );
  }

  return (
    <Badge variant="secondary" className="flex items-center space-x-1 bg-green-100 text-green-800">
      <CheckCircle className="w-3 h-3" />
      <span>Google connected</span>
    </Badge>
  );
};

export default AuthStatus;
