-- Applied to production on 26 September 2026, once the staff workspace change that stops
-- calling these from the browser was confirmed live. Applied earlier, the item buttons in the
-- workspace would have stopped working.
--
-- Checked after applying: anon and authenticated are refused on all three; service_role runs
-- them (a mark with an unknown staff id returns "Only an active staff member can mark items.").
--
-- ayp_staff_mark_items, ayp_setup_remove_items and ayp_setup_add_items were called straight
-- from the staff workspace with the public key, each passing a staff id the browser supplied.
-- Anyone with that key (it ships in the site's bundle) and any staff id could mark, add or
-- remove items on a live setup job. They now run only through manage-setup-tasks
-- (action staff_setup_items), which checks the staff session and takes the staff id from it,
-- and penny-staff-chat, which uses the service key. So EXECUTE comes away from everyone else.

revoke execute on function public.ayp_staff_mark_items(uuid, uuid[], boolean, boolean) from public, anon, authenticated;
revoke execute on function public.ayp_setup_remove_items(uuid, uuid[], uuid, boolean) from public, anon, authenticated;
revoke execute on function public.ayp_setup_add_items(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ayp_staff_mark_items(uuid, uuid[], boolean, boolean) to service_role;
grant execute on function public.ayp_setup_remove_items(uuid, uuid[], uuid, boolean) to service_role;
grant execute on function public.ayp_setup_add_items(uuid, uuid, jsonb) to service_role;
