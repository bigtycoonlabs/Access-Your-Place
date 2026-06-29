-- ============================================================
-- RLS FIX MIGRATION — AccessYourPlace Production
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- STEP 1: Enable RLS on every public table
-- (safe to run even if already enabled)

ALTER TABLE IF EXISTS public.account_funding_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.account_link_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acquisition_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acquisition_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acquisition_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acquisition_workflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acquisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agreement_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agreement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_property_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_suggested_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.am_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.am_assignment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.am_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.archived_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.article_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blog_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.certification_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.competitor_data_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.corporate_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_usage_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_calendar_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_calendly_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_flow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_flow_step_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cron_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cron_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.custom_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deal_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deal_alert_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deal_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deal_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deal_flow_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deal_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deal_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deal_match_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deal_performance_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deal_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deal_status_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deal_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deal_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deal_workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.digital_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.discovered_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.discovery_call_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.document_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.download_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.download_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.draft_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.error_alert_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.error_digest_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.executive_deal_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.follow_up_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.follow_up_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.followup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.followup_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.insert_test ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.intake_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_acquisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_checklist_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_credit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_deal_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_pipeline_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_property_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_report_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_tutorial_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investor_widget_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.issue_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.landlord_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.landlord_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.landlord_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.landlord_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.landlord_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.landlord_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.landlord_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.legacy_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.legal_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_data_refresh_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_data_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_seasonality_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_shift_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.marketplace_closed_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.marketplace_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.marketplace_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.marketplace_verification_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mentor_communication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.monthly_portfolio_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.outreach_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.outreach_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.page_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.penny_accuracy_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.penny_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.penny_common_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.penny_conversation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.penny_deal_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.penny_investor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.penny_monthly_accuracy_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.penny_score_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.penny_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.penny_score_refresh_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.penny_training_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.penny_weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pipeline_email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pipeline_email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.platform_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.platform_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.platform_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.platform_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.portfolio_ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.portfolio_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.portfolio_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.portfolio_monthly_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.portfolio_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.private_deal_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_performance_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referral_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.regulation_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.report_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.research_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.research_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resident_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resident_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resident_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.revenue_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.seller_document_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.seller_listing_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.session_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.setup_media_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.setup_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.setup_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.setup_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sms_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sop_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sop_repository ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sop_update_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sop_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_compliance_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_payment_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transaction_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weekly_summary_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.zip_market_data ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 2: Service-role bypass policy on internal/log tables
-- (staff edge functions use service_role and need full access)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='account_link_suggestions' AND policyname='service_role_all_account_link_suggestions') THEN
    EXECUTE 'CREATE POLICY service_role_all_account_link_suggestions ON public.account_link_suggestions TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='archived_properties' AND policyname='service_role_all_archived_properties') THEN
    EXECUTE 'CREATE POLICY service_role_all_archived_properties ON public.archived_properties TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='article_generation_logs' AND policyname='service_role_all_article_generation_logs') THEN
    EXECUTE 'CREATE POLICY service_role_all_article_generation_logs ON public.article_generation_logs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='auth_errors' AND policyname='service_role_all_auth_errors') THEN
    EXECUTE 'CREATE POLICY service_role_all_auth_errors ON public.auth_errors TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='certification_progress' AND policyname='service_role_all_certification_progress') THEN
    EXECUTE 'CREATE POLICY service_role_all_certification_progress ON public.certification_progress TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='competitor_data_tracking' AND policyname='service_role_all_competitor_data_tracking') THEN
    EXECUTE 'CREATE POLICY service_role_all_competitor_data_tracking ON public.competitor_data_tracking TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_flow_logs' AND policyname='service_role_all_crm_flow_logs') THEN
    EXECUTE 'CREATE POLICY service_role_all_crm_flow_logs ON public.crm_flow_logs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_flow_step_queue' AND policyname='service_role_all_crm_flow_step_queue') THEN
    EXECUTE 'CREATE POLICY service_role_all_crm_flow_step_queue ON public.crm_flow_step_queue TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cron_execution_log' AND policyname='service_role_all_cron_execution_log') THEN
    EXECUTE 'CREATE POLICY service_role_all_cron_execution_log ON public.cron_execution_log TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cron_job_logs' AND policyname='service_role_all_cron_job_logs') THEN
    EXECUTE 'CREATE POLICY service_role_all_cron_job_logs ON public.cron_job_logs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_activity_log' AND policyname='service_role_all_deal_activity_log') THEN
    EXECUTE 'CREATE POLICY service_role_all_deal_activity_log ON public.deal_activity_log TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_alert_logs' AND policyname='service_role_all_deal_alert_logs') THEN
    EXECUTE 'CREATE POLICY service_role_all_deal_alert_logs ON public.deal_alert_logs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_analytics_events' AND policyname='service_role_all_deal_analytics_events') THEN
    EXECUTE 'CREATE POLICY service_role_all_deal_analytics_events ON public.deal_analytics_events TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_flow_notifications' AND policyname='service_role_all_deal_flow_notifications') THEN
    EXECUTE 'CREATE POLICY service_role_all_deal_flow_notifications ON public.deal_flow_notifications TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_match_notifications' AND policyname='service_role_all_deal_match_notifications') THEN
    EXECUTE 'CREATE POLICY service_role_all_deal_match_notifications ON public.deal_match_notifications TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_performance_tracking' AND policyname='service_role_all_deal_performance_tracking') THEN
    EXECUTE 'CREATE POLICY service_role_all_deal_performance_tracking ON public.deal_performance_tracking TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_status_notifications' AND policyname='service_role_all_deal_status_notifications') THEN
    EXECUTE 'CREATE POLICY service_role_all_deal_status_notifications ON public.deal_status_notifications TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_workflow_stages' AND policyname='service_role_all_deal_workflow_stages') THEN
    EXECUTE 'CREATE POLICY service_role_all_deal_workflow_stages ON public.deal_workflow_stages TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='discovered_topics' AND policyname='service_role_all_discovered_topics') THEN
    EXECUTE 'CREATE POLICY service_role_all_discovered_topics ON public.discovered_topics TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='download_tracking' AND policyname='service_role_all_download_tracking') THEN
    EXECUTE 'CREATE POLICY service_role_all_download_tracking ON public.download_tracking TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_campaigns' AND policyname='service_role_all_email_campaigns') THEN
    EXECUTE 'CREATE POLICY service_role_all_email_campaigns ON public.email_campaigns TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_delivery_logs' AND policyname='service_role_all_email_delivery_logs') THEN
    EXECUTE 'CREATE POLICY service_role_all_email_delivery_logs ON public.email_delivery_logs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_logs' AND policyname='service_role_all_email_logs') THEN
    EXECUTE 'CREATE POLICY service_role_all_email_logs ON public.email_logs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_notification_logs' AND policyname='service_role_all_email_notification_logs') THEN
    EXECUTE 'CREATE POLICY service_role_all_email_notification_logs ON public.email_notification_logs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_unsubscribe_tokens' AND policyname='service_role_all_email_unsubscribe_tokens') THEN
    EXECUTE 'CREATE POLICY service_role_all_email_unsubscribe_tokens ON public.email_unsubscribe_tokens TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='error_alert_log' AND policyname='service_role_all_error_alert_log') THEN
    EXECUTE 'CREATE POLICY service_role_all_error_alert_log ON public.error_alert_log TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='error_digest_log' AND policyname='service_role_all_error_digest_log') THEN
    EXECUTE 'CREATE POLICY service_role_all_error_digest_log ON public.error_digest_log TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='error_logs' AND policyname='service_role_all_error_logs') THEN
    EXECUTE 'CREATE POLICY service_role_all_error_logs ON public.error_logs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='executive_deal_tracking' AND policyname='service_role_all_executive_deal_tracking') THEN
    EXECUTE 'CREATE POLICY service_role_all_executive_deal_tracking ON public.executive_deal_tracking TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='insert_test' AND policyname='service_role_all_insert_test') THEN
    EXECUTE 'CREATE POLICY service_role_all_insert_test ON public.insert_test TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='legacy_properties' AND policyname='service_role_all_legacy_properties') THEN
    EXECUTE 'CREATE POLICY service_role_all_legacy_properties ON public.legacy_properties TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_data_refresh_logs' AND policyname='service_role_all_market_data_refresh_logs') THEN
    EXECUTE 'CREATE POLICY service_role_all_market_data_refresh_logs ON public.market_data_refresh_logs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketplace_verification_alerts' AND policyname='service_role_all_marketplace_verification_alerts') THEN
    EXECUTE 'CREATE POLICY service_role_all_marketplace_verification_alerts ON public.marketplace_verification_alerts TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mentor_communication_log' AND policyname='service_role_all_mentor_communication_log') THEN
    EXECUTE 'CREATE POLICY service_role_all_mentor_communication_log ON public.mentor_communication_log TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='oauth_states' AND policyname='service_role_all_oauth_states') THEN
    EXECUTE 'CREATE POLICY service_role_all_oauth_states ON public.oauth_states TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='oauth_tokens' AND policyname='service_role_all_oauth_tokens') THEN
    EXECUTE 'CREATE POLICY service_role_all_oauth_tokens ON public.oauth_tokens TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outreach_notes' AND policyname='service_role_all_outreach_notes') THEN
    EXECUTE 'CREATE POLICY service_role_all_outreach_notes ON public.outreach_notes TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outreach_tracking' AND policyname='service_role_all_outreach_tracking') THEN
    EXECUTE 'CREATE POLICY service_role_all_outreach_tracking ON public.outreach_tracking TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='page_events' AND policyname='service_role_all_page_events') THEN
    EXECUTE 'CREATE POLICY service_role_all_page_events ON public.page_events TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='password_reset_tokens' AND policyname='service_role_all_password_reset_tokens') THEN
    EXECUTE 'CREATE POLICY service_role_all_password_reset_tokens ON public.password_reset_tokens TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_accuracy_scores' AND policyname='service_role_all_penny_accuracy_scores') THEN
    EXECUTE 'CREATE POLICY service_role_all_penny_accuracy_scores ON public.penny_accuracy_scores TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_monthly_accuracy_reports' AND policyname='service_role_all_penny_monthly_accuracy_reports') THEN
    EXECUTE 'CREATE POLICY service_role_all_penny_monthly_accuracy_reports ON public.penny_monthly_accuracy_reports TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_score_alerts' AND policyname='service_role_all_penny_score_alerts') THEN
    EXECUTE 'CREATE POLICY service_role_all_penny_score_alerts ON public.penny_score_alerts TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_score_history' AND policyname='service_role_all_penny_score_history') THEN
    EXECUTE 'CREATE POLICY service_role_all_penny_score_history ON public.penny_score_history TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_score_refresh_log' AND policyname='service_role_all_penny_score_refresh_log') THEN
    EXECUTE 'CREATE POLICY service_role_all_penny_score_refresh_log ON public.penny_score_refresh_log TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_training_recommendations' AND policyname='service_role_all_penny_training_recommendations') THEN
    EXECUTE 'CREATE POLICY service_role_all_penny_training_recommendations ON public.penny_training_recommendations TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_weekly_reports' AND policyname='service_role_all_penny_weekly_reports') THEN
    EXECUTE 'CREATE POLICY service_role_all_penny_weekly_reports ON public.penny_weekly_reports TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pipeline_email_log' AND policyname='service_role_all_pipeline_email_log') THEN
    EXECUTE 'CREATE POLICY service_role_all_pipeline_email_log ON public.pipeline_email_log TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pipeline_email_sequences' AND policyname='service_role_all_pipeline_email_sequences') THEN
    EXECUTE 'CREATE POLICY service_role_all_pipeline_email_sequences ON public.pipeline_email_sequences TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='platform_sync_logs' AND policyname='service_role_all_platform_sync_logs') THEN
    EXECUTE 'CREATE POLICY service_role_all_platform_sync_logs ON public.platform_sync_logs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='platform_webhooks' AND policyname='service_role_all_platform_webhooks') THEN
    EXECUTE 'CREATE POLICY service_role_all_platform_webhooks ON public.platform_webhooks TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='push_notification_log' AND policyname='service_role_all_push_notification_log') THEN
    EXECUTE 'CREATE POLICY service_role_all_push_notification_log ON public.push_notification_log TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rate_limits' AND policyname='service_role_all_rate_limits') THEN
    EXECUTE 'CREATE POLICY service_role_all_rate_limits ON public.rate_limits TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='report_generation_logs' AND policyname='service_role_all_report_generation_logs') THEN
    EXECUTE 'CREATE POLICY service_role_all_report_generation_logs ON public.report_generation_logs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='research_queue' AND policyname='service_role_all_research_queue') THEN
    EXECUTE 'CREATE POLICY service_role_all_research_queue ON public.research_queue TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='research_topics' AND policyname='service_role_all_research_topics') THEN
    EXECUTE 'CREATE POLICY service_role_all_research_topics ON public.research_topics TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='security_alerts' AND policyname='service_role_all_security_alerts') THEN
    EXECUTE 'CREATE POLICY service_role_all_security_alerts ON public.security_alerts TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='session_sync' AND policyname='service_role_all_session_sync') THEN
    EXECUTE 'CREATE POLICY service_role_all_session_sync ON public.session_sync TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sms_logs' AND policyname='service_role_all_sms_logs') THEN
    EXECUTE 'CREATE POLICY service_role_all_sms_logs ON public.sms_logs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sms_webhook_logs' AND policyname='service_role_all_sms_webhook_logs') THEN
    EXECUTE 'CREATE POLICY service_role_all_sms_webhook_logs ON public.sms_webhook_logs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sop_acknowledgments' AND policyname='service_role_all_sop_acknowledgments') THEN
    EXECUTE 'CREATE POLICY service_role_all_sop_acknowledgments ON public.sop_acknowledgments TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sop_repository' AND policyname='service_role_all_sop_repository') THEN
    EXECUTE 'CREATE POLICY service_role_all_sop_repository ON public.sop_repository TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sop_update_notifications' AND policyname='service_role_all_sop_update_notifications') THEN
    EXECUTE 'CREATE POLICY service_role_all_sop_update_notifications ON public.sop_update_notifications TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sop_versions' AND policyname='service_role_all_sop_versions') THEN
    EXECUTE 'CREATE POLICY service_role_all_sop_versions ON public.sop_versions TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff' AND policyname='service_role_all_staff') THEN
    EXECUTE 'CREATE POLICY service_role_all_staff ON public.staff TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_certifications' AND policyname='service_role_all_staff_certifications') THEN
    EXECUTE 'CREATE POLICY service_role_all_staff_certifications ON public.staff_certifications TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_commissions' AND policyname='service_role_all_staff_commissions') THEN
    EXECUTE 'CREATE POLICY service_role_all_staff_commissions ON public.staff_commissions TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_compliance_docs' AND policyname='service_role_all_staff_compliance_docs') THEN
    EXECUTE 'CREATE POLICY service_role_all_staff_compliance_docs ON public.staff_compliance_docs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_departments' AND policyname='service_role_all_staff_departments') THEN
    EXECUTE 'CREATE POLICY service_role_all_staff_departments ON public.staff_departments TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_members' AND policyname='service_role_all_staff_members') THEN
    EXECUTE 'CREATE POLICY service_role_all_staff_members ON public.staff_members TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_messages' AND policyname='service_role_all_staff_messages') THEN
    EXECUTE 'CREATE POLICY service_role_all_staff_messages ON public.staff_messages TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_notifications' AND policyname='service_role_all_staff_notifications') THEN
    EXECUTE 'CREATE POLICY service_role_all_staff_notifications ON public.staff_notifications TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_payment_profiles' AND policyname='service_role_all_staff_payment_profiles') THEN
    EXECUTE 'CREATE POLICY service_role_all_staff_payment_profiles ON public.staff_payment_profiles TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_time_entries' AND policyname='service_role_all_staff_time_entries') THEN
    EXECUTE 'CREATE POLICY service_role_all_staff_time_entries ON public.staff_time_entries TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_users' AND policyname='service_role_all_staff_users') THEN
    EXECUTE 'CREATE POLICY service_role_all_staff_users ON public.staff_users TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_weekly_reports' AND policyname='service_role_all_staff_weekly_reports') THEN
    EXECUTE 'CREATE POLICY service_role_all_staff_weekly_reports ON public.staff_weekly_reports TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='webhook_events' AND policyname='service_role_all_webhook_events') THEN
    EXECUTE 'CREATE POLICY service_role_all_webhook_events ON public.webhook_events TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='weekly_summary_queue' AND policyname='service_role_all_weekly_summary_queue') THEN
    EXECUTE 'CREATE POLICY service_role_all_weekly_summary_queue ON public.weekly_summary_queue TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ============================================================
-- STEP 3: Public read-only policies for deal/property tables
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_suggested_questions' AND policyname='public_read_ai_suggested_questions') THEN
    EXECUTE 'CREATE POLICY public_read_ai_suggested_questions ON public.ai_suggested_questions FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_suggested_questions' AND policyname='service_role_all_ai_suggested_questions') THEN
    EXECUTE 'CREATE POLICY service_role_all_ai_suggested_questions ON public.ai_suggested_questions TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blog_articles' AND policyname='public_read_blog_articles') THEN
    EXECUTE 'CREATE POLICY public_read_blog_articles ON public.blog_articles FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blog_articles' AND policyname='service_role_all_blog_articles') THEN
    EXECUTE 'CREATE POLICY service_role_all_blog_articles ON public.blog_articles TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_analytics' AND policyname='public_read_deal_analytics') THEN
    EXECUTE 'CREATE POLICY public_read_deal_analytics ON public.deal_analytics FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_analytics' AND policyname='service_role_all_deal_analytics') THEN
    EXECUTE 'CREATE POLICY service_role_all_deal_analytics ON public.deal_analytics TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_listings' AND policyname='public_read_deal_listings') THEN
    EXECUTE 'CREATE POLICY public_read_deal_listings ON public.deal_listings FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_listings' AND policyname='service_role_all_deal_listings') THEN
    EXECUTE 'CREATE POLICY service_role_all_deal_listings ON public.deal_listings TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='digital_products' AND policyname='public_read_digital_products') THEN
    EXECUTE 'CREATE POLICY public_read_digital_products ON public.digital_products FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='digital_products' AND policyname='service_role_all_digital_products') THEN
    EXECUTE 'CREATE POLICY service_role_all_digital_products ON public.digital_products TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='discovery_call_requests' AND policyname='public_read_discovery_call_requests') THEN
    EXECUTE 'CREATE POLICY public_read_discovery_call_requests ON public.discovery_call_requests FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='discovery_call_requests' AND policyname='service_role_all_discovery_call_requests') THEN
    EXECUTE 'CREATE POLICY service_role_all_discovery_call_requests ON public.discovery_call_requests TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='download_leads' AND policyname='public_read_download_leads') THEN
    EXECUTE 'CREATE POLICY public_read_download_leads ON public.download_leads FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='download_leads' AND policyname='service_role_all_download_leads') THEN
    EXECUTE 'CREATE POLICY service_role_all_download_leads ON public.download_leads TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='draft_articles' AND policyname='public_read_draft_articles') THEN
    EXECUTE 'CREATE POLICY public_read_draft_articles ON public.draft_articles FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='draft_articles' AND policyname='service_role_all_draft_articles') THEN
    EXECUTE 'CREATE POLICY service_role_all_draft_articles ON public.draft_articles TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_templates' AND policyname='public_read_email_templates') THEN
    EXECUTE 'CREATE POLICY public_read_email_templates ON public.email_templates FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_templates' AND policyname='service_role_all_email_templates') THEN
    EXECUTE 'CREATE POLICY service_role_all_email_templates ON public.email_templates TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leads' AND policyname='public_read_leads') THEN
    EXECUTE 'CREATE POLICY public_read_leads ON public.leads FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leads' AND policyname='service_role_all_leads') THEN
    EXECUTE 'CREATE POLICY service_role_all_leads ON public.leads TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_benchmarks' AND policyname='public_read_market_benchmarks') THEN
    EXECUTE 'CREATE POLICY public_read_market_benchmarks ON public.market_benchmarks FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_benchmarks' AND policyname='service_role_all_market_benchmarks') THEN
    EXECUTE 'CREATE POLICY service_role_all_market_benchmarks ON public.market_benchmarks TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_data_snapshots' AND policyname='public_read_market_data_snapshots') THEN
    EXECUTE 'CREATE POLICY public_read_market_data_snapshots ON public.market_data_snapshots FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_data_snapshots' AND policyname='service_role_all_market_data_snapshots') THEN
    EXECUTE 'CREATE POLICY service_role_all_market_data_snapshots ON public.market_data_snapshots TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_report_templates' AND policyname='public_read_market_report_templates') THEN
    EXECUTE 'CREATE POLICY public_read_market_report_templates ON public.market_report_templates FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_report_templates' AND policyname='service_role_all_market_report_templates') THEN
    EXECUTE 'CREATE POLICY service_role_all_market_report_templates ON public.market_report_templates TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_reports' AND policyname='public_read_market_reports') THEN
    EXECUTE 'CREATE POLICY public_read_market_reports ON public.market_reports FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_reports' AND policyname='service_role_all_market_reports') THEN
    EXECUTE 'CREATE POLICY service_role_all_market_reports ON public.market_reports TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_seasonality_calendar' AND policyname='public_read_market_seasonality_calendar') THEN
    EXECUTE 'CREATE POLICY public_read_market_seasonality_calendar ON public.market_seasonality_calendar FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_seasonality_calendar' AND policyname='service_role_all_market_seasonality_calendar') THEN
    EXECUTE 'CREATE POLICY service_role_all_market_seasonality_calendar ON public.market_seasonality_calendar TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_shift_alerts' AND policyname='public_read_market_shift_alerts') THEN
    EXECUTE 'CREATE POLICY public_read_market_shift_alerts ON public.market_shift_alerts FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_shift_alerts' AND policyname='service_role_all_market_shift_alerts') THEN
    EXECUTE 'CREATE POLICY service_role_all_market_shift_alerts ON public.market_shift_alerts TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_templates' AND policyname='public_read_message_templates') THEN
    EXECUTE 'CREATE POLICY public_read_message_templates ON public.message_templates FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_templates' AND policyname='service_role_all_message_templates') THEN
    EXECUTE 'CREATE POLICY service_role_all_message_templates ON public.message_templates TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_common_questions' AND policyname='public_read_penny_common_questions') THEN
    EXECUTE 'CREATE POLICY public_read_penny_common_questions ON public.penny_common_questions FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_common_questions' AND policyname='service_role_all_penny_common_questions') THEN
    EXECUTE 'CREATE POLICY service_role_all_penny_common_questions ON public.penny_common_questions TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='properties' AND policyname='public_read_properties') THEN
    EXECUTE 'CREATE POLICY public_read_properties ON public.properties FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='properties' AND policyname='service_role_all_properties') THEN
    EXECUTE 'CREATE POLICY service_role_all_properties ON public.properties TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='property_analytics' AND policyname='public_read_property_analytics') THEN
    EXECUTE 'CREATE POLICY public_read_property_analytics ON public.property_analytics FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='property_analytics' AND policyname='service_role_all_property_analytics') THEN
    EXECUTE 'CREATE POLICY service_role_all_property_analytics ON public.property_analytics TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='property_photos' AND policyname='public_read_property_photos') THEN
    EXECUTE 'CREATE POLICY public_read_property_photos ON public.property_photos FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='property_photos' AND policyname='service_role_all_property_photos') THEN
    EXECUTE 'CREATE POLICY service_role_all_property_photos ON public.property_photos TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='regulation_alerts' AND policyname='public_read_regulation_alerts') THEN
    EXECUTE 'CREATE POLICY public_read_regulation_alerts ON public.regulation_alerts FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='regulation_alerts' AND policyname='service_role_all_regulation_alerts') THEN
    EXECUTE 'CREATE POLICY service_role_all_regulation_alerts ON public.regulation_alerts TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='zip_market_data' AND policyname='public_read_zip_market_data') THEN
    EXECUTE 'CREATE POLICY public_read_zip_market_data ON public.zip_market_data FOR SELECT USING (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='zip_market_data' AND policyname='service_role_all_zip_market_data') THEN
    EXECUTE 'CREATE POLICY service_role_all_zip_market_data ON public.zip_market_data TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ============================================================
-- STEP 4: Investor-owned row policies
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_acquisitions' AND policyname='investor_own_investor_acquisitions') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_acquisitions ON public.investor_acquisitions USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_acquisitions' AND policyname='service_role_all_investor_acquisitions') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_acquisitions ON public.investor_acquisitions TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_activity_logs' AND policyname='investor_own_investor_activity_logs') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_activity_logs ON public.investor_activity_logs USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_activity_logs' AND policyname='service_role_all_investor_activity_logs') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_activity_logs ON public.investor_activity_logs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_calendar_events' AND policyname='investor_own_investor_calendar_events') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_calendar_events ON public.investor_calendar_events USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_calendar_events' AND policyname='service_role_all_investor_calendar_events') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_calendar_events ON public.investor_calendar_events TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_chat_conversations' AND policyname='investor_own_investor_chat_conversations') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_chat_conversations ON public.investor_chat_conversations USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_chat_conversations' AND policyname='service_role_all_investor_chat_conversations') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_chat_conversations ON public.investor_chat_conversations TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_checklist_progress' AND policyname='investor_own_investor_checklist_progress') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_checklist_progress ON public.investor_checklist_progress USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_checklist_progress' AND policyname='service_role_all_investor_checklist_progress') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_checklist_progress ON public.investor_checklist_progress TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_communications' AND policyname='investor_own_investor_communications') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_communications ON public.investor_communications USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_communications' AND policyname='service_role_all_investor_communications') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_communications ON public.investor_communications TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_credit_transactions' AND policyname='investor_own_investor_credit_transactions') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_credit_transactions ON public.investor_credit_transactions USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_credit_transactions' AND policyname='service_role_all_investor_credit_transactions') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_credit_transactions ON public.investor_credit_transactions TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_credits' AND policyname='investor_own_investor_credits') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_credits ON public.investor_credits USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_credits' AND policyname='service_role_all_investor_credits') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_credits ON public.investor_credits TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_deal_preferences' AND policyname='investor_own_investor_deal_preferences') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_deal_preferences ON public.investor_deal_preferences USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_deal_preferences' AND policyname='service_role_all_investor_deal_preferences') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_deal_preferences ON public.investor_deal_preferences TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_dispute_messages' AND policyname='investor_own_investor_dispute_messages') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_dispute_messages ON public.investor_dispute_messages USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_dispute_messages' AND policyname='service_role_all_investor_dispute_messages') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_dispute_messages ON public.investor_dispute_messages TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_disputes' AND policyname='investor_own_investor_disputes') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_disputes ON public.investor_disputes USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_disputes' AND policyname='service_role_all_investor_disputes') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_disputes ON public.investor_disputes TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_documents' AND policyname='investor_own_investor_documents') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_documents ON public.investor_documents USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_documents' AND policyname='service_role_all_investor_documents') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_documents ON public.investor_documents TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_favorites' AND policyname='investor_own_investor_favorites') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_favorites ON public.investor_favorites USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_favorites' AND policyname='service_role_all_investor_favorites') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_favorites ON public.investor_favorites TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_login_history' AND policyname='investor_own_investor_login_history') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_login_history ON public.investor_login_history USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_login_history' AND policyname='service_role_all_investor_login_history') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_login_history ON public.investor_login_history TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_messages' AND policyname='investor_own_investor_messages') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_messages ON public.investor_messages USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_messages' AND policyname='service_role_all_investor_messages') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_messages ON public.investor_messages TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_notification_preferences' AND policyname='investor_own_investor_notification_preferences') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_notification_preferences ON public.investor_notification_preferences USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_notification_preferences' AND policyname='service_role_all_investor_notification_preferences') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_notification_preferences ON public.investor_notification_preferences TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_notifications' AND policyname='investor_own_investor_notifications') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_notifications ON public.investor_notifications USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_notifications' AND policyname='service_role_all_investor_notifications') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_notifications ON public.investor_notifications TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_pipeline_history' AND policyname='investor_own_investor_pipeline_history') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_pipeline_history ON public.investor_pipeline_history USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_pipeline_history' AND policyname='service_role_all_investor_pipeline_history') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_pipeline_history ON public.investor_pipeline_history TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_portfolio' AND policyname='investor_own_investor_portfolio') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_portfolio ON public.investor_portfolio USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_portfolio' AND policyname='service_role_all_investor_portfolio') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_portfolio ON public.investor_portfolio TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_profiles' AND policyname='investor_own_investor_profiles') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_profiles ON public.investor_profiles USING (auth.uid() = id) WITH CHECK (auth.uid() = id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_profiles' AND policyname='service_role_all_investor_profiles') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_profiles ON public.investor_profiles TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_referrals' AND policyname='investor_own_investor_referrals') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_referrals ON public.investor_referrals USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_referrals' AND policyname='service_role_all_investor_referrals') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_referrals ON public.investor_referrals TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_searches' AND policyname='investor_own_investor_searches') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_searches ON public.investor_searches USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_searches' AND policyname='service_role_all_investor_searches') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_searches ON public.investor_searches TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_sessions' AND policyname='investor_own_investor_sessions') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_sessions ON public.investor_sessions USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_sessions' AND policyname='service_role_all_investor_sessions') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_sessions ON public.investor_sessions TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_tutorial_progress' AND policyname='investor_own_investor_tutorial_progress') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_tutorial_progress ON public.investor_tutorial_progress USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_tutorial_progress' AND policyname='service_role_all_investor_tutorial_progress') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_tutorial_progress ON public.investor_tutorial_progress TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_widget_settings' AND policyname='investor_own_investor_widget_settings') THEN
    EXECUTE 'CREATE POLICY investor_own_investor_widget_settings ON public.investor_widget_settings USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_widget_settings' AND policyname='service_role_all_investor_widget_settings') THEN
    EXECUTE 'CREATE POLICY service_role_all_investor_widget_settings ON public.investor_widget_settings TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investors' AND policyname='investor_own_investors') THEN
    EXECUTE 'CREATE POLICY investor_own_investors ON public.investors USING (auth.uid() = id) WITH CHECK (auth.uid() = id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investors' AND policyname='service_role_all_investors') THEN
    EXECUTE 'CREATE POLICY service_role_all_investors ON public.investors TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_chat_history' AND policyname='investor_own_penny_chat_history') THEN
    EXECUTE 'CREATE POLICY investor_own_penny_chat_history ON public.penny_chat_history USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_chat_history' AND policyname='service_role_all_penny_chat_history') THEN
    EXECUTE 'CREATE POLICY service_role_all_penny_chat_history ON public.penny_chat_history TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_conversation_logs' AND policyname='investor_own_penny_conversation_logs') THEN
    EXECUTE 'CREATE POLICY investor_own_penny_conversation_logs ON public.penny_conversation_logs USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_conversation_logs' AND policyname='service_role_all_penny_conversation_logs') THEN
    EXECUTE 'CREATE POLICY service_role_all_penny_conversation_logs ON public.penny_conversation_logs TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_deal_scores' AND policyname='investor_own_penny_deal_scores') THEN
    EXECUTE 'CREATE POLICY investor_own_penny_deal_scores ON public.penny_deal_scores USING (auth.uid() = investor_id) WITH CHECK (auth.uid() = investor_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_deal_scores' AND policyname='service_role_all_penny_deal_scores') THEN
    EXECUTE 'CREATE POLICY service_role_all_penny_deal_scores ON public.penny_deal_scores TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_investor_profiles' AND policyname='investor_own_penny_investor_profiles') THEN
    EXECUTE 'CREATE POLICY investor_own_penny_investor_profiles ON public.penny_investor_profiles USING (auth.uid() = id) WITH CHECK (auth.uid() = id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penny_investor_profiles' AND policyname='service_role_all_penny_investor_profiles') THEN
    EXECUTE 'CREATE POLICY service_role_all_penny_investor_profiles ON public.penny_investor_profiles TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ============================================================
-- STEP 5: Remaining tables — service_role full access
-- (catches any table not in above categories)
-- ============================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT IN (
      SELECT DISTINCT tablename FROM pg_policies WHERE schemaname = 'public'
    )
  LOOP
    EXECUTE format(
      'CREATE POLICY service_role_fallback_%s ON public.%I TO service_role USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- DONE. Refresh your Supabase dashboard advisors to verify.
-- ============================================================