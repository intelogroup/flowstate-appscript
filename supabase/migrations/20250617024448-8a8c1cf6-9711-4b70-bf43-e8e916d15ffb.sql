
-- Add unique constraint on user_id to allow upsert operations
ALTER TABLE public.user_auth_tokens 
ADD CONSTRAINT user_auth_tokens_user_id_unique UNIQUE (user_id);
