-- Landlord portal signing.
--
-- Landlords had no way to sign anything in their portal: a lease reached "lease generated"
-- and then waited on a status button with no signature behind it. Staff now send a landlord
-- a document to sign (optionally tied to one of their corporate applications), and the
-- landlord signs it in the portal. Signing a lease moves that application to lease_signed.
--
-- Same shape as every other table here: the base table lives in the project schema and
-- public exposes a view. Only the manage-landlord-portal edge function (service role) reads
-- or writes it; the anon and authenticated roles get nothing, so a signature can never be
-- read or forged from the browser with the public key.
--
-- The signature image is kept on the row (a PNG data URL, typically 10-40KB) because this
-- project has no "signatures" storage bucket.

create table if not exists "prj_X-ZoVQv6LKXT".landlord_signatures (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null,
  corporate_application_id uuid,
  landlord_property_id uuid,
  document_name text not null,
  document_type text not null default 'other'
    check (document_type in ('lease', 'lease_addendum', 'agreement', 'disclosure', 'other')),
  document_url text,
  document_content text,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'viewed', 'signed', 'declined', 'cancelled', 'expired')),
  sent_by uuid,
  sent_by_name text,
  sent_at timestamptz not null default now(),
  viewed_at timestamptz,
  expires_at timestamptz,
  signed_at timestamptz,
  signer_name text,
  signature_type text check (signature_type in ('drawn', 'typed')),
  signature_image text,
  initials text,
  signed_ip text,
  signed_user_agent text,
  -- sha256 of what was shown at signing (document_url + document_content), so a later
  -- change to the document cannot be passed off as what was signed.
  document_hash text,
  declined_at timestamptz,
  decline_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landlord_signatures_landlord_idx
  on "prj_X-ZoVQv6LKXT".landlord_signatures (landlord_id, created_at desc);
create index if not exists landlord_signatures_application_idx
  on "prj_X-ZoVQv6LKXT".landlord_signatures (corporate_application_id)
  where corporate_application_id is not null;

alter table "prj_X-ZoVQv6LKXT".landlord_signatures enable row level security;

create or replace view public.landlord_signatures as
  select * from "prj_X-ZoVQv6LKXT".landlord_signatures;
revoke all on public.landlord_signatures from anon, authenticated;
revoke all on "prj_X-ZoVQv6LKXT".landlord_signatures from anon, authenticated;
grant select, insert, update on public.landlord_signatures to service_role;
grant select, insert, update on "prj_X-ZoVQv6LKXT".landlord_signatures to service_role;

notify pgrst, 'reload schema';
