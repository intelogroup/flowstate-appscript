
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
}

interface FlowProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  flowName: string;
  progress: FlowProgress | null;
}

const FlowProgressModal = ({ isOpen, onClose, flowName, progress }: FlowProgressModalProps) => {
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

          {/* Results Summary */}
          {progress?.results && (
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

          {/* Error */}
          {progress?.error && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-red-700">Error Details</h4>
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {progress.error}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FlowProgressModal;
