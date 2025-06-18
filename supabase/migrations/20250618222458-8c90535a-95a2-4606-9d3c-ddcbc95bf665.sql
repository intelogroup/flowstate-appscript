
-- Create the flow execution logs table
CREATE TABLE public.flow_execution_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL,
  user_id UUID NOT NULL,
  flow_name TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  success BOOLEAN NOT NULL DEFAULT false,
  attachments_processed INTEGER DEFAULT 0,
  emails_found INTEGER DEFAULT 0,
  emails_processed INTEGER DEFAULT 0,
  total_duration_ms INTEGER,
  apps_script_duration_ms INTEGER,
  error_message TEXT,
  request_id TEXT,
  version TEXT,
  auth_method TEXT,
  apps_script_response JSONB,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security
ALTER TABLE public.flow_execution_logs ENABLE ROW LEVEL SECURITY;

-- Create policy that allows users to view their own execution logs
CREATE POLICY "Users can view their own execution logs" 
  ON public.flow_execution_logs 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy that allows users to insert their own execution logs
CREATE POLICY "Users can create their own execution logs" 
  ON public.flow_execution_logs 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries by user and flow
CREATE INDEX idx_flow_execution_logs_user_flow ON public.flow_execution_logs(user_id, flow_id, started_at DESC);

-- Create index for auto-cleanup
CREATE INDEX idx_flow_execution_logs_expires_at ON public.flow_execution_logs(expires_at);

-- Create function to clean up expired logs
CREATE OR REPLACE FUNCTION public.cleanup_expired_flow_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.flow_execution_logs 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup operation
  RAISE NOTICE 'Cleaned up % expired flow execution logs', deleted_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
