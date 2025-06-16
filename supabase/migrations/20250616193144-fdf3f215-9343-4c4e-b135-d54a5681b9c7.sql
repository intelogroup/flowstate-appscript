
-- Update the existing "Myflow" to use the new frontend-compatible structure
-- Extract the sender email from the current email_filter and add it as a senders field

-- First, let's see if we can add a senders column to store the extracted sender information
ALTER TABLE public.user_configurations ADD COLUMN IF NOT EXISTS senders TEXT;

-- Update the "Myflow" record to extract sender from email_filter and populate senders field
-- Assuming the email_filter is in format "from:(sender@email.com) has:attachment"
UPDATE public.user_configurations 
SET 
  senders = CASE 
    WHEN email_filter LIKE 'from:(%' THEN 
      REGEXP_REPLACE(
        REGEXP_REPLACE(email_filter, '^from:\(', ''), 
        '\).*$', ''
      )
    ELSE 'jayveedz19@gmail.com' -- Default fallback
  END,
  email_filter = CASE 
    WHEN senders IS NOT NULL OR email_filter LIKE 'from:(%' THEN 
      'from:(' || COALESCE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(email_filter, '^from:\(', ''), 
          '\).*$', ''
        ), 
        'jayveedz19@gmail.com'
      ) || ') has:attachment'
    ELSE email_filter
  END
WHERE flow_name = 'Myflow';
