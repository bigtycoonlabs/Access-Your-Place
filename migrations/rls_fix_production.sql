-- ============================================================
-- RLS FIX MIGRATION — AccessYourPlace Production
-- Safe to re-run at any time (all operations are idempotent)
-- ============================================================

-- STEP 1: Enable RLS on every table that exists in public schema
-- (ALTER TABLE IF EXISTS silently skips non-existent tables)

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;


-- STEP 2: Grant service_role full bypass on every existing public table
-- (skips tables that already have this policy)

DO $$
DECLARE
  t TEXT;
  policy_name TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    policy_name := 'service_role_all_' || t;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I TO service_role USING (true) WITH CHECK (true)',
        policy_name, t
      );
    END IF;
  END LOOP;
END $$;


-- STEP 3: Public read-only access on deal/property/content tables

DO $$
DECLARE
  public_read_tables TEXT[] := ARRAY[
    'properties', 'deal_listings', 'deal_analytics', 'property_analytics',
    'property_photos', 'blog_articles', 'draft_articles', 'market_reports',
    'market_benchmarks', 'market_data_snapshots', 'market_report_templates',
    'market_seasonality_calendar', 'market_shift_alerts', 'regulation_alerts',
    'zip_market_data', 'email_templates', 'message_templates', 'digital_products',
    'discovery_call_requests', 'download_leads', 'leads',
    'penny_common_questions', 'ai_suggested_questions'
  ];
  t TEXT;
  policy_name TEXT;
BEGIN
  FOREACH t IN ARRAY public_read_tables
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      policy_name := 'public_read_' || t;
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t AND policyname = policy_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT USING (true)',
          policy_name, t
        );
      END IF;
    END IF;
  END LOOP;
END $$;


-- STEP 4: Investor-owned row policies (investor_id = auth.uid())

DO $$
DECLARE
  investor_id_tables TEXT[] := ARRAY[
    'investor_acquisitions', 'investor_activity_logs', 'investor_calendar_events',
    'investor_chat_conversations', 'investor_checklist_progress', 'investor_communications',
    'investor_credit_requests', 'investor_credit_transactions', 'investor_credits',
    'investor_deal_preferences', 'investor_dispute_messages', 'investor_disputes',
    'investor_documents', 'investor_favorites', 'investor_invitations',
    'investor_login_history', 'investor_messages', 'investor_notification_preferences',
    'investor_notifications', 'investor_pipeline_history', 'investor_portfolio',
    'investor_property_access', 'investor_referrals', 'investor_report_preferences',
    'investor_searches', 'investor_segments', 'investor_sessions',
    'investor_social_accounts', 'investor_tag_assignments', 'investor_tutorial_progress',
    'investor_widget_settings', 'penny_chat_history', 'penny_conversation_logs',
    'penny_deal_scores'
  ];
  t TEXT;
  policy_name TEXT;
BEGIN
  FOREACH t IN ARRAY investor_id_tables
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      policy_name := 'investor_own_' || t;
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t AND policyname = policy_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)',
          policy_name, t
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- investor_profiles and penny_investor_profiles use id column
DO $$
DECLARE
  id_tables TEXT[] := ARRAY['investor_profiles', 'penny_investor_profiles', 'investors'];
  t TEXT;
  policy_name TEXT;
BEGIN
  FOREACH t IN ARRAY id_tables
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      policy_name := 'investor_own_' || t;
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t AND policyname = policy_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I USING (auth.uid() = id) WITH CHECK (auth.uid() = id)',
          policy_name, t
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- DONE. All existing tables now have RLS enabled + policies.
-- New tables added later will need this run again, or add
-- policies individually at creation time.
-- ============================================================
