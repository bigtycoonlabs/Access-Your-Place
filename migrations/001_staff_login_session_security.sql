-- Migration: add columns required by staff-login v39 (rate limiting + session tokens)
-- These columns are referenced by the deployed staff-login function but were never
-- migrated into the database, causing every login query to fail at the PostgREST
-- level (selecting nonexistent columns returns an error, not null). This is the
-- root cause of the reported staff login outage.
--
-- Run this against the real Postgres database before deploying the corrected
-- backend/server.js staff-login logic.

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_failed_login timestamp with time zone,
  ADD COLUMN IF NOT EXISTS session_token text,
  ADD COLUMN IF NOT EXISTS session_expires timestamp with time zone;

-- Optional but recommended: index for fast session token lookups (validate_session action)
CREATE INDEX IF NOT EXISTS idx_staff_users_session_token ON staff_users (session_token) WHERE session_token IS NOT NULL;

-- landlord_contacts.forgot_password/reset_password is called by the real frontend
-- (LandlordLogin.tsx) but has no matching action in the deployed landlord-auth v1
-- source and no reset_token columns in the schema -- this was an incomplete feature
-- even in the original system. Adding the columns here so the now-completed
-- forgot_password/reset_password actions in server.js actually work end to end.
ALTER TABLE landlord_contacts
  ADD COLUMN IF NOT EXISTS reset_token text,
  ADD COLUMN IF NOT EXISTS reset_token_expires timestamp with time zone;
