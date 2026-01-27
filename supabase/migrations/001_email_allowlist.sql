-- Email Allowlist Migration
-- This creates server-side enforcement of the email allowlist
-- Run this after schema.sql

-- Table to store allowed email addresses
CREATE TABLE IF NOT EXISTS allowed_emails (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS allowed_emails_email_idx ON allowed_emails(email);

-- Insert your allowed emails here
-- Example: INSERT INTO allowed_emails (email) VALUES ('a@alexreynolds.com');

-- Function to check if an email is allowed during signup
CREATE OR REPLACE FUNCTION public.check_email_allowed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the email exists in the allowlist
  IF NOT EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE lower(email) = lower(NEW.email)
  ) THEN
    -- If allowlist is empty, allow all emails (for initial setup)
    IF EXISTS (SELECT 1 FROM public.allowed_emails LIMIT 1) THEN
      RAISE EXCEPTION 'Email address not authorized';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to check email on insert
-- Note: This requires the trigger to be created on the auth schema
-- You may need to run this as a superuser or via Supabase dashboard SQL editor
DO $$
BEGIN
  -- Drop existing trigger if it exists
  DROP TRIGGER IF EXISTS check_email_allowed_trigger ON auth.users;

  -- Create the trigger
  CREATE TRIGGER check_email_allowed_trigger
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.check_email_allowed();
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Could not create trigger on auth.users - run this in Supabase dashboard SQL editor';
END;
$$;

-- Grant necessary permissions
GRANT SELECT ON public.allowed_emails TO authenticated;
GRANT SELECT ON public.allowed_emails TO service_role;
