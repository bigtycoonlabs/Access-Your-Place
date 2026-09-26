-- Applied to production on 26 September 2026.
-- Close SECURITY DEFINER functions that anyone on the internet could call.
--
-- These run as postgres and bypass row-level security, and EXECUTE was granted to PUBLIC
-- (so to anon, whose key ships in the browser bundle). Every caller below was checked
-- first: each is reached only from an edge function using the service role key, so taking
-- EXECUTE away from PUBLIC, anon and authenticated changes nothing for the real path and
-- stops a signed-out caller reaching them over /rest/v1/rpc.
--
--   Writers
--     ayp_pro_mark_item        manage-setup-tasks (pro_mark_item action)
--     ayp_penny_escalate       ai-investor-chat
--     ayp_log_contact          no caller in the repo
--     ayp_grant_signup_credit  investor-register
--   Readers of client files (not on the 26 Sep handover's list, found while checking it)
--     penny_client_book           penny-staff-chat
--     penny_client_file_overview  penny-staff-chat
--     penny_find_client_file      penny-staff-chat
--     penny_operations_snapshot   penny-staff-brief
--
-- Deliberately NOT changed here:
--   ayp_staff_mark_items, ayp_setup_remove_items, ayp_setup_add_items are still called
--   straight from the staff workspace in the browser. They move behind manage-setup-tasks
--   (which checks the staff session) first; a later migration revokes them.
--   ayp_sweep_stale_alerts stays callable on purpose: the daily ayp-alert-sweep workflow
--   calls it with the public key, it takes no arguments and it can only retract alerts.
--
-- search_path: the eleven public-callable definer functions that had none get one pinned,
-- so a caller who can create objects cannot shadow a name they use unqualified. The value
-- matches what they resolved against before (the database default), minus the caller's
-- own schema, with pg_temp last.

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.ayp_pro_mark_item(text, uuid, boolean, boolean)',
    'public.ayp_penny_escalate(uuid, text, text)',
    'public.ayp_log_contact(uuid, text, uuid, uuid, text, uuid)',
    'public.ayp_grant_signup_credit(uuid)',
    'public.penny_client_book()',
    'public.penny_client_file_overview()',
    'public.penny_find_client_file(text, integer)',
    'public.penny_operations_snapshot()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;

  foreach f in array array[
    'public.ayp_pro_mark_item(text, uuid, boolean, boolean)',
    'public.ayp_penny_escalate(uuid, text, text)',
    'public.ayp_log_contact(uuid, text, uuid, uuid, text, uuid)',
    'public.penny_client_book()',
    'public.penny_client_file_overview()',
    'public.penny_find_client_file(text, integer)',
    'public.penny_operations_snapshot()',
    'public.ayp_staff_mark_items(uuid, uuid[], boolean, boolean)',
    'public.ayp_setup_remove_items(uuid, uuid[], uuid, boolean)',
    'public.ayp_setup_add_items(uuid, uuid, jsonb)',
    'public.ayp_sweep_stale_alerts()'
  ] loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', f);
  end loop;
end $$;
