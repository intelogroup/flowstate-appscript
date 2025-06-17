
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Database, RefreshCw, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthTokenService, AuthToken } from '@/services/authTokenService';

const SavedTokensPanel = React.memo(() => {
  const { user } = useAuth();
  const [savedTokens, setSavedTokens] = useState<AuthToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSavedTokens = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const tokens = await AuthTokenService.getTokens(user.id);
      setSavedTokens(tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tokens');
    } finally {
      setLoading(false);
    }
  };

  const deleteSavedTokens = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      await AuthTokenService.deleteTokens(user.id);
      setSavedTokens(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tokens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedTokens();
  }, [user?.id]);

  if (!user) {
    return null;
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center space-x-2">
          <Database className="w-4 h-4" />
          <span>💾 Saved Auth Tokens</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchSavedTokens}
            disabled={loading}
            className="h-6 px-2"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {savedTokens ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500">Provider:</span>
                <Badge variant="default" className="ml-2 text-xs">
                  {savedTokens.provider}
                </Badge>
              </div>

              <div>
                <span className="text-gray-500">Status:</span>
                <Badge variant="default" className="ml-2 text-xs bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Saved
                </Badge>
              </div>

              <div>
                <span className="text-gray-500">Access Token:</span>
                <span className="ml-2 font-mono text-xs">
                  {savedTokens.access_token ? `${savedTokens.access_token.substring(0, 20)}...` : 'None'}
                </span>
              </div>

              <div>
                <span className="text-gray-500">Provider Token:</span>
                <span className="ml-2 font-mono text-xs">
                  {savedTokens.provider_token ? `${savedTokens.provider_token.substring(0, 20)}...` : 'None'}
                </span>
              </div>

              <div>
                <span className="text-gray-500">Refresh Token:</span>
                <span className="ml-2 font-mono text-xs">
                  {savedTokens.refresh_token ? `${savedTokens.refresh_token.substring(0, 20)}...` : 'None'}
                </span>
              </div>

              <div>
                <span className="text-gray-500">Expires:</span>
                <span className="ml-2 font-mono text-xs">
                  {savedTokens.expires_at ? new Date(savedTokens.expires_at).toLocaleString() : 'Unknown'}
                </span>
              </div>

              <div className="col-span-2">
                <span className="text-gray-500">Saved:</span>
                <span className="ml-2 font-mono text-xs">
                  {savedTokens.created_at ? new Date(savedTokens.created_at).toLocaleString() : 'Unknown'}
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSavedTokens}
                disabled={loading}
                className="h-7 px-3 text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete Saved Tokens
              </Button>
            </div>
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {loading ? 'Loading saved tokens...' : 'No tokens saved in database yet. Tokens will be saved automatically when you sign in.'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
});

SavedTokensPanel.displayName = 'SavedTokensPanel';

export default SavedTokensPanel;
