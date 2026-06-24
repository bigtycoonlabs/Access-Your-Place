-- Saved Deals: custom application schema
-- This migration is intentionally non-destructive. If duplicate favorites already
-- exist, it stops before creating the unique index so they can be reviewed first.

CREATE SCHEMA IF NOT EXISTS "prj_X-ZoVQv6LKXT";

CREATE TABLE IF NOT EXISTS "prj_X-ZoVQv6LKXT".investor_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES "prj_X-ZoVQv6LKXT".investors(id) ON DELETE CASCADE,
  property_id UUID,
  property_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_favorites_investor
  ON "prj_X-ZoVQv6LKXT".investor_favorites(investor_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "prj_X-ZoVQv6LKXT".investor_favorites
    GROUP BY investor_id, property_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot create unique investor_favorites index: duplicate investor_id/property_id rows exist. Review and merge them before rerunning this migration.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_favorites_investor_property_unique
  ON "prj_X-ZoVQv6LKXT".investor_favorites(investor_id, property_id);
