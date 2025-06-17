
import React from 'react';
import { Button } from '@/components/ui/button';
import { Zap, LogOut, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import AuthStatus from '@/components/AuthStatus';

interface AppHeaderProps {
  userEmail?: string;
  onLogout: () => void;
}

const AppHeader = React.memo(({ userEmail, onLogout }: AppHeaderProps) => {
  return (
    <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                FlowState
              </h1>
              <p className="text-xs text-gray-500">Automation Platform</p>
            </div>
          </Link>
          
          <div className="flex items-center space-x-4">
            <AuthStatus />
            
            {userEmail && (
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-gray-50 rounded-lg">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700 max-w-48 truncate">{userEmail}</span>
              </div>
            )}
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onLogout}
              className="hover:bg-red-50 hover:text-red-600 hover:border-red-200"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
});

AppHeader.displayName = 'AppHeader';

export default AppHeader;
