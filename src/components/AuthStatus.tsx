
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const AuthStatus = () => {
  const { user, isGoogleConnected } = useAuth();
  
  if (!user) {
    return (
      <Link to="/auth">
        <Badge variant="outline" className="flex items-center space-x-1 hover:bg-gray-50">
          <AlertCircle className="w-3 h-3" />
          <span>Sign In</span>
          <ExternalLink className="w-3 h-3" />
        </Badge>
      </Link>
    );
  }

  if (!isGoogleConnected) {
    return (
      <Link to="/auth">
        <Badge variant="outline" className="flex items-center space-x-1 hover:bg-blue-50 text-blue-700 border-blue-200">
          <AlertCircle className="w-3 h-3" />
          <span>Connect Google</span>
          <ExternalLink className="w-3 h-3" />
        </Badge>
      </Link>
    );
  }

  return (
    <Badge variant="outline" className="flex items-center space-x-1 bg-green-50 text-green-700 border-green-200">
      <CheckCircle className="w-3 h-3" />
      <span>Connected</span>
    </Badge>
  );
};

export default AuthStatus;
