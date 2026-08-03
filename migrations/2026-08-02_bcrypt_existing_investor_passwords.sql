-- P1: bcrypt-hash existing plain-text investor passwords, in place.
--
-- Context: investor-register historically stored passwords in plain text in
-- "prj_X-ZoVQv6LKXT".investors.password_hash. The updated register/login functions now
-- hash with bcrypt and self-upgrade legacy rows on next login. This migration upgrades
-- ALL remaining plain-text rows at once so nothing sits in plain text waiting for a login.
--
-- Safe: investor-login already accepts bcrypt ($2*) hashes, so no one is locked out — the
-- same password keeps working, just verified against the hash. Idempotent: rows already
-- hashed ($2*) are skipped. RUN ONCE, AFTER the register/login bcrypt change is deployed.
--
-- pgcrypto's gen_salt('bf') produces standard bcrypt ($2a$) hashes, which the login
-- function's bcrypt check verifies.

create extension if not exists pgcrypto with schema extensions;

update "prj_X-ZoVQv6LKXT".investors
   set password_hash = crypt(password_hash, gen_salt('bf'))
 where password_hash is not null
   and password_hash <> ''
   and password_hash not like '$2%';

-- Verify afterwards (should return 0):
--   select count(*) from "prj_X-ZoVQv6LKXT".investors
--    where password_hash is not null and password_hash <> '' and password_hash not like '$2%';
