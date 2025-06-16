
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const LoadingState = React.memo(() => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Flows</CardTitle>
        <CardDescription>Loading your Gmail to Drive flows...</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center p-8">
          <div className="w-8 h-8 bg-blue-600 rounded-full animate-pulse"></div>
        </div>
      </CardContent>
    </Card>
  );
});

LoadingState.displayName = 'LoadingState';

export default LoadingState;
