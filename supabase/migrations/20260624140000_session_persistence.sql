-- Session persistence prerequisites for the custom application schema.
-- Non-destructive: existing tables/columns and data are preserved.

CREATE SCHEMA IF NOT EXISTS "prj_X-ZoVQv6LKXT";

CREATE TABLE IF NOT EXISTS "prj_X-ZoVQv6LKXT".investor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES "prj_X-ZoVQv6LKXT".investors(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  device_info JSONB,
  ip_address TEXT,
  user_agent TEXT,
  remember_me BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE "prj_X-ZoVQv6LKXT".staff_users
  ADD COLUMN IF NOT EXISTS session_token TEXT,
  ADD COLUMN IF NOT EXISTS session_expires TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

ALTER TABLE "prj_X-ZoVQv6LKXT".investors
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "prj_X-ZoVQv6LKXT".investor_sessions
    GROUP BY session_token
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot create unique investor_sessions token index: duplicate session_token rows exist. Review them before rerunning this migration.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_sessions_token_unique
  ON "prj_X-ZoVQv6LKXT".investor_sessions(session_token);

CREATE INDEX IF NOT EXISTS idx_investor_sessions_investor
  ON "prj_X-ZoVQv6LKXT".investor_sessions(investor_id);

CREATE INDEX IF NOT EXISTS idx_investor_sessions_active_expires
  ON "prj_X-ZoVQv6LKXT".investor_sessions(is_active, expires_at);
