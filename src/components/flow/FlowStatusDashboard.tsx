
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { FlowExecutionService } from '@/services/flowExecution';
import { useAuth } from '@/contexts/AuthContext';

interface SystemHealth {
  supabase: boolean;
  appsScript: boolean;
  webhook: boolean;
  lastChecked: string;
}

interface FlowStatusDashboardProps {
  onShowDebug: () => void;
}

const FlowStatusDashboard = ({ onShowDebug }: FlowStatusDashboardProps) => {
  const { user, isGoogleConnected } = useAuth();
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    supabase: false,
    appsScript: false,
    webhook: false,
    lastChecked: ''
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkSystemHealth = async () => {
    setIsChecking(true);
    try {
      // Check Apps Script health
      const appsScriptHealth = await FlowExecutionService.checkAppsScriptHealth();
      
      // Check Supabase connection (basic auth check)
      const supabaseHealth = !!user;
      
      // For now, assume webhook is healthy if others are
      const webhookHealth = appsScriptHealth && supabaseHealth;

      setSystemHealth({
        supabase: supabaseHealth,
        appsScript: appsScriptHealth,
        webhook: webhookHealth,
        lastChecked: new Date().toLocaleTimeString()
      });
    } catch (error) {
      console.error('Health check failed:', error);
      setSystemHealth(prev => ({
        ...prev,
        lastChecked: new Date().toLocaleTimeString()
      }));
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkSystemHealth();
  }, [user, isGoogleConnected]);

  const getOverallStatus = () => {
    const allHealthy = systemHealth.supabase && systemHealth.appsScript && systemHealth.webhook;
    const someHealthy = systemHealth.supabase || systemHealth.appsScript || systemHealth.webhook;
    
    if (allHealthy) return { status: 'healthy', color: 'text-green-600', icon: Wifi };
    if (someHealthy) return { status: 'partial', color: 'text-yellow-600', icon: AlertTriangle };
    return { status: 'error', color: 'text-red-600', icon: WifiOff };
  };

  const overallStatus = getOverallStatus();
  const StatusIcon = overallStatus.icon;

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </CardTitle>
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${overallStatus.color}`} />
            <Button
              onClick={checkSystemHealth}
              disabled={isChecking}
              variant="outline"
              size="sm"
            >
              {isChecking ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Authentication Status */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Authentication</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">User Login</span>
              <Badge className={user ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                {user ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Google Auth</span>
              <Badge className={isGoogleConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                {isGoogleConnected ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Service Health */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Service Health</h4>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm">Supabase</span>
              <Badge className={systemHealth.supabase ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                {systemHealth.supabase ? 'Online' : 'Offline'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Apps Script</span>
              <Badge className={systemHealth.appsScript ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                {systemHealth.appsScript ? 'Online' : 'Offline'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Webhook Handler</span>
              <Badge className={systemHealth.webhook ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                {systemHealth.webhook ? 'Online' : 'Offline'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Last Check */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Last checked: {systemHealth.lastChecked || 'Never'}</span>
          <Button onClick={onShowDebug} variant="ghost" size="sm" className="text-xs">
            Debug Panel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FlowStatusDashboard;
