-- Applied to production on 16 September 2026.
-- 1. analytics_events gains attribution columns; old rows backfilled; blank rows removed.
-- 2. ayp_source_label groups referrers (facebook subdomains, google, our own domain as direct).
-- 3. ayp_analytics_report(session_token, days): staff-only report behind the staff sign-in.
-- 4. ayp_sync_verification_tier trigger keeps properties.verification_tier equal to the evidence.
-- The function bodies are the live definitions; read them with pg_get_functiondef.

alter table "prj_X-ZoVQv6LKXT".analytics_events
  add column if not exists utm_source text, add column if not exists utm_medium text,
  add column if not exists utm_campaign text, add column if not exists utm_term text,
  add column if not exists utm_content text, add column if not exists landing_path text,
  add column if not exists first_referrer text, add column if not exists referrer_domain text,
  add column if not exists device text, add column if not exists country text,
  add column if not exists is_internal boolean not null default false;
create index if not exists analytics_events_created_idx on "prj_X-ZoVQv6LKXT".analytics_events (created_at desc);
create index if not exists analytics_events_session_idx on "prj_X-ZoVQv6LKXT".analytics_events (session_id);
create index if not exists analytics_events_name_idx on "prj_X-ZoVQv6LKXT".analytics_events (event_name) where event_name is not null;
create or replace view public.analytics_events as select * from "prj_X-ZoVQv6LKXT".analytics_events;
revoke all on public.analytics_events from anon, authenticated;
notify pgrst, 'reload schema';
