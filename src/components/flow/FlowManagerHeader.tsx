
import React from 'react';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const FlowManagerHeader = React.memo(() => {
  return (
    <CardHeader>
      <CardTitle>Your Flows</CardTitle>
      <CardDescription>Manage and execute your Gmail to Drive flows</CardDescription>
    </CardHeader>
  );
});

FlowManagerHeader.displayName = 'FlowManagerHeader';

export default FlowManagerHeader;
