-- 2026-08-11
-- anon could delete the marketplace.
--
-- WHAT WAS WRONG
-- public.marketplace_public is the read-only projection every public page reads.
-- It is auto-updatable (information_schema.views.is_updatable = YES), it has no
-- security_invoker option, and it is owned by postgres, which is rolbypassrls.
-- A view in that shape checks base-table permission as its owner, so RLS on
-- "prj_X-ZoVQv6LKXT".properties gave no protection through it.
--
-- anon held arwdDxtm on the view. The anon key ships inside the site's JavaScript
-- bundle, so it is public by construction.
--
-- PROVEN AGAINST PRODUCTION, not inferred:
--   DELETE /rest/v1/marketplace_public?id=eq.<impossible uuid>   -> HTTP 204
--   PATCH  /rest/v1/marketplace_public?id=eq.<real uuid>
--     Prefer: return=minimal, count=exact                        -> content-range: 0-0/1
-- One row matched and was updated by an anonymous caller. The write reached
-- "prj_X-ZoVQv6LKXT".properties.
--
-- Safe to revoke: no code writes to this view. Two files in src/ reference
-- marketplace_public at all and both only read.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.marketplace_public FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.marketplace_public FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.marketplace_public FROM yp_flow_app;
GRANT SELECT ON public.marketplace_public TO anon, authenticated;

-- Nothing truncates the staff table from a browser.
REVOKE TRUNCATE ON public.staff FROM anon;
REVOKE TRUNCATE ON public.staff FROM authenticated;

-- SEPARATE BUG, same view.
-- marketplace_public computes the verification badge by calling
-- public.ayp_verification_tier(id). anon had no EXECUTE on that function, so every
-- public read that selected the tier column failed with
--   401 {"code":"42501","message":"permission denied for function ayp_verification_tier"}
-- The deals page caught it, fell back to the get-properties edge function, and
-- rendered correctly. Nobody could see that the primary path was dead. If the edge
-- function had also failed the marketplace would have gone blank.
--
-- The function is STABLE SECURITY DEFINER with SET search_path TO '' and returns
-- only 'ayp_verified' or 'penny_scan' for a uuid. It exposes nothing else.
GRANT EXECUTE ON FUNCTION public.ayp_verification_tier(uuid) TO anon, authenticated;

-- AFTER, verified as anon against production:
--   DELETE marketplace_public  -> 401 permission denied for view marketplace_public
--   PATCH  marketplace_public  -> 401 permission denied for view marketplace_public
--   SELECT * marketplace_public -> 200, 2 rows, both verification_tier=ayp_verified,
--                                  no address/landlord/url columns present
--   accessyourplace.com/deals  -> "Strategy 1 (REST) success: 2 properties",
--                                 RESOLVED via REST, zero console 401s
--
-- STILL OPEN, needs the walk-every-caller sweep before it can be revoked:
--   anon holds SELECT, INSERT and UPDATE on public.properties, and SELECT/INSERT/
--   UPDATE on public.property_photos. Staff screens in src/components/admin and
--   src/components/dealflow write to both directly from the browser as anon
--   (DealKanbanBoard, PhotoUploadManager, DealVerificationTab, PropertyAssignmentModal,
--   AddressCorrectionTool, StaffPortfolioManager). Revoking today takes the staff
--   console down. Those writes have to move behind edge functions first.
