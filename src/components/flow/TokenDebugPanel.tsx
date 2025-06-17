
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const TokenDebugPanel = React.memo(() => {
  const { session, isTokenValid, forceTokenRefresh, isGoogleConnected } = useAuth();

  if (!session) {
    return null;
  }

  const expiresAt = session.expires_at;
  const currentTime = Date.now() / 1000;
  const timeUntilExpiry = expiresAt ? expiresAt - currentTime : 0;
  const minutesUntilExpiry = Math.round(timeUntilExpiry / 60);
  const tokenValid = isTokenValid();

  const handleRefreshToken = async () => {
    console.log('[TOKEN DEBUG] Manual token refresh requested');
    await forceTokenRefresh();
  };

  const getTokenStatus = () => {
    if (!tokenValid) {
      return { variant: 'destructive' as const, icon: AlertCircle, text: 'Expired/Invalid' };
    }
    if (minutesUntilExpiry < 10) {
      return { variant: 'secondary' as const, icon: Clock, text: 'Expiring Soon' };
    }
    return { variant: 'default' as const, icon: CheckCircle, text: 'Valid' };
  };

  const tokenStatus = getTokenStatus();

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center space-x-2">
          <span>🔐 Token Debug Panel</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshToken}
            className="h-6 px-2"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-gray-500">Status:</span>
            <Badge variant={tokenStatus.variant} className="ml-2 text-xs">
              <tokenStatus.icon className="w-3 h-3 mr-1" />
              {tokenStatus.text}
            </Badge>
          </div>
          
          <div>
            <span className="text-gray-500">Google Connected:</span>
            <Badge variant={isGoogleConnected ? "default" : "destructive"} className="ml-2 text-xs">
              {isGoogleConnected ? '✅ Yes' : '❌ No'}
            </Badge>
          </div>

          {expiresAt && (
            <>
              <div>
                <span className="text-gray-500">Expires:</span>
                <span className="ml-2 font-mono text-xs">
                  {new Date(expiresAt * 1000).toLocaleTimeString()}
                </span>
              </div>
              
              <div>
                <span className="text-gray-500">Time Left:</span>
                <span className="ml-2 font-mono text-xs">
                  {minutesUntilExpiry > 0 ? `${minutesUntilExpiry}m` : 'Expired'}
                </span>
              </div>
            </>
          )}

          <div>
            <span className="text-gray-500">Provider Token:</span>
            <span className="ml-2 font-mono text-xs">
              {session.provider_token ? `${session.provider_token.length} chars` : 'None'}
            </span>
          </div>

          <div>
            <span className="text-gray-500">Access Token:</span>
            <span className="ml-2 font-mono text-xs">
              {session.access_token ? `${session.access_token.length} chars` : 'None'}
            </span>
          </div>
        </div>

        {!tokenValid && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Token is expired or invalid. Flow executions will fail until refreshed.
            </AlertDescription>
          </Alert>
        )}

        {tokenValid && minutesUntilExpiry < 10 && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Token expires in {minutesUntilExpiry} minutes. Consider refreshing.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
});

TokenDebugPanel.displayName = 'TokenDebugPanel';

export default TokenDebugPanel;
