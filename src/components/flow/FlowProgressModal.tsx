
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, AlertCircle, Loader2, RefreshCw, Bug } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FlowProgress {
  status: 'idle' | 'started' | 'processing' | 'completed' | 'error';
  message: string;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  results?: {
    emailsFound: number;
    attachmentsSaved: number;
    processingTime: string;
  };
  files?: any[];
  error?: string;
  details?: any;
}

interface FlowProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  flowName: string;
  progress: FlowProgress | null;
  onRetry?: () => void;
  onShowDebug?: () => void;
}

const FlowProgressModal = ({ 
  isOpen, 
  onClose, 
  flowName, 
  progress, 
  onRetry,
  onShowDebug 
}: FlowProgressModalProps) => {
  const getStatusIcon = () => {
    if (!progress) return <Clock className="h-5 w-5 text-gray-400" />;
    
    switch (progress.status) {
      case 'started':
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = () => {
    if (!progress) return <Badge variant="secondary">Initializing</Badge>;
    
    switch (progress.status) {
      case 'started':
        return <Badge className="bg-blue-100 text-blue-700">Started</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-100 text-yellow-700">Processing</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700">Error</Badge>;
      default:
        return <Badge variant="secondary">Idle</Badge>;
    }
  };

  const isError = progress?.status === 'error';
  const isCompleted = progress?.status === 'completed';
  const isProcessing = progress?.status === 'started' || progress?.status === 'processing';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {getStatusIcon()}
            <span>Flow Progress: {flowName}</span>
            {getStatusBadge()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Status */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Current Status</h4>
            <p className="text-sm text-gray-600">
              {progress?.message || 'Initializing flow...'}
            </p>
          </div>

          {/* Progress Bar */}
          {progress?.progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Progress</span>
                <span className="font-medium">
                  {progress.progress.current}/{progress.progress.total} ({progress.progress.percentage}%)
                </span>
              </div>
              <Progress value={progress.progress.percentage} className="h-2" />
            </div>
          )}

          {/* Error Alert */}
          {isError && progress?.error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                <div className="space-y-2">
                  <p className="font-medium">Execution Failed</p>
                  <p className="text-sm">{progress.error}</p>
                  {progress.details && (
                    <details className="text-xs">
                      <summary className="cursor-pointer font-medium">Technical Details</summary>
                      <pre className="mt-2 bg-red-100 p-2 rounded text-xs overflow-auto">
                        {JSON.stringify(progress.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Results Summary */}
          {progress?.results && isCompleted && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Results</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Emails Found:</span>
                  <span className="ml-2 font-medium">{progress.results.emailsFound}</span>
                </div>
                <div>
                  <span className="text-gray-600">Attachments Saved:</span>
                  <span className="ml-2 font-medium">{progress.results.attachmentsSaved}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Processing Time:</span>
                  <span className="ml-2 font-medium">{progress.results.processingTime}</span>
                </div>
              </div>
            </div>
          )}

          {/* Files */}
          {progress?.files && progress.files.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Saved Files</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {progress.files.map((file, index) => (
                  <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                    <div className="font-medium truncate">{file.savedName || file.name}</div>
                    <div className="text-gray-500">{file.size || 'Unknown size'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between pt-4">
            <div className="flex gap-2">
              {onShowDebug && (
                <Button onClick={onShowDebug} variant="outline" size="sm">
                  <Bug className="h-4 w-4 mr-1" />
                  Debug
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {isError && onRetry && (
                <Button onClick={onRetry} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry
                </Button>
              )}
              <Button onClick={onClose} variant={isError ? "default" : "outline"} size="sm">
                {isProcessing ? 'Background' : 'Close'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FlowProgressModal;
