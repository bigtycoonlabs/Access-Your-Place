-- 2026-08-11. A property had two prices. Owner decision: the acquisition fee IS the
-- price of the operation. There is no separate asking price.
--
-- Before: 24 properties. All 24 had acquisition_fee. Only 3 had asking_price, and on
-- all 3 the two numbers disagreed by exactly $350 (8000/8350, 8000/8350, 7150/7500).
-- Those 3 are the Cleveland units. Every public page already displayed
-- acquisition_fee, so nothing a buyer sees changed.
--
-- The column is not dropped. The three historical values stay in the base table.
-- It is removed from every view and every code path so only one number can exist.
--
-- Two live defects were found while doing this and are fixed in the same change:
--
-- 1. am-submit-deal wrote the price an acquisition manager typed into `price`, a
--    column that is null on all 24 rows and read by nothing, and then hardcoded
--    acquisition_fee to 2500. Every deal submitted through that path was priced at
--    $2,500 whatever the AM entered. 12 of 24 properties currently sit at exactly
--    2500. The figure now lands in acquisition_fee.
--
-- 2. notify-matching-investors filtered investors by budget against asking_price,
--    which is null on every property, so both comparisons ran against undefined and
--    the price filter never excluded anyone. It now reads acquisition_fee.
COMMENT ON COLUMN "prj_X-ZoVQv6LKXT".properties.asking_price IS
  'RETIRED 2026-08-11. The price of an operation is acquisition_fee. Do not read, write or display.';
COMMENT ON COLUMN "prj_X-ZoVQv6LKXT".properties.price IS
  'DEAD 2026-08-11. Null on all rows, read by nothing. The price is acquisition_fee.';
-- public.marketplace_public was rebuilt without asking_price. See
-- 2026-08-11_revoke_anon_write_marketplace_public.sql for the grant handling, which
-- matters: DROP VIEW discards the ACL and Supabase default privileges hand anon full
-- write on anything newly created in public.
