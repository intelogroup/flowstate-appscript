
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bug } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DebugPanelProps {
  debugInfo: string[];
  onClear: () => void;
  onExport: () => void;
}

const DebugPanel = React.memo(({ debugInfo, onClear, onExport }: DebugPanelProps) => {
  if (debugInfo.length === 0) return null;

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <Bug className="w-5 h-5 mr-2 text-yellow-600" />
            Debug Information ({debugInfo.length}/20)
          </CardTitle>
          <div className="flex space-x-2">
            <Button 
              onClick={onExport} 
              variant="outline" 
              size="sm"
              className="text-yellow-700 border-yellow-300"
            >
              📁 Export
            </Button>
            <Button 
              onClick={onClear} 
              variant="outline" 
              size="sm"
              className="text-yellow-700 border-yellow-300"
            >
              🧹 Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {debugInfo.map((info, index) => (
            <div 
              key={index} 
              className={`text-xs font-mono p-2 rounded ${
                info.includes('❌') || info.includes('💥') 
                  ? 'text-red-800 bg-red-100 border border-red-200' 
                  : info.includes('✅') || info.includes('🎉')
                  ? 'text-green-800 bg-green-100 border border-green-200'
                  : 'text-yellow-800 bg-yellow-100 border border-yellow-200'
              }`}
            >
              {info}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

DebugPanel.displayName = 'DebugPanel';

export default DebugPanel;
