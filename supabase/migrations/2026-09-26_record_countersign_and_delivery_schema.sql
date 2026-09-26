-- RECORD, not a new change. Applied to production on 25 September 2026 by an earlier
-- session straight through the database, and written down here on 26 September so the
-- schema behind landlord countersignature and document delivery is in version control
-- next to the code that uses it (supabase/functions/deliver-document, staff-countersign,
-- manage-landlord-portal). Every statement is idempotent, so running it again is a no-op.
-- The definitions below were read back from production, not retyped.

-- Landlord countersignature: the company signs a landlord document after (or before) the
-- landlord. countersign_role 'owner' means only an owner can execute it.
alter table "prj_X-ZoVQv6LKXT".landlord_signatures
  add column if not exists countersign_role text not null default 'owner',
  add column if not exists countersigned_by uuid,
  add column if not exists countersigned_by_name text,
  add column if not exists countersigned_at timestamptz,
  add column if not exists signing_order text not null default 'client_first',
  add column if not exists released_to_client_at timestamptz;

-- Both kinds of document in one staff queue, with party_kind saying which.
create or replace view public.staff_countersign_queue as
SELECT d.id,
    d.document_name,
    d.document_type,
    d.investor_name,
    d.investor_email,
    d.investor_id,
    d.signature_status,
    d.signed_at,
    d.document_url,
    d.countersign_role,
    d.countersigned_by_name,
    d.countersigned_at,
    d.countersigned_at IS NOT NULL AS company_signed,
    'investor'::text AS party_kind,
    NULL::uuid AS landlord_id,
    d.investor_name AS counterparty_name,
    d.investor_email AS counterparty_email,
    NULL::uuid AS corporate_application_id
   FROM "prj_X-ZoVQv6LKXT".document_signatures d
  WHERE d.signature_status = ANY (ARRAY['signed'::text, 'pending'::text, 'viewed'::text])
UNION ALL
 SELECT s.id,
    s.document_name,
    s.document_type,
    COALESCE(l.name, s.signer_name::character varying) AS investor_name,
    l.email AS investor_email,
    NULL::uuid AS investor_id,
    s.status AS signature_status,
    s.signed_at,
    s.document_url,
    s.countersign_role,
    s.countersigned_by_name,
    s.countersigned_at,
    s.countersigned_at IS NOT NULL AS company_signed,
    'landlord'::text AS party_kind,
    s.landlord_id,
    COALESCE(l.name, s.signer_name::character varying) AS counterparty_name,
    l.email AS counterparty_email,
    s.corporate_application_id
   FROM "prj_X-ZoVQv6LKXT".landlord_signatures s
     LEFT JOIN "prj_X-ZoVQv6LKXT".landlord_contacts l ON l.id = s.landlord_id
  WHERE s.status = ANY (ARRAY['signed'::text, 'pending'::text, 'viewed'::text]);
revoke all on public.staff_countersign_queue from anon, authenticated;

-- Runs as postgres; callable only by service_role (staff-countersign), search_path pinned.
CREATE OR REPLACE FUNCTION public.ayp_countersign_document(p_document_id uuid, p_staff_id uuid, p_typed_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'prj_X-ZoVQv6LKXT', 'pg_temp'
AS $function$
declare
  doc record; who record; bag text; may boolean; company_first boolean;
  is_landlord boolean := false; v_status text; v_party_name text; v_block text; v_name text;
begin
  v_name := coalesce(trim(p_typed_name), '');

  select ds.id, ds.document_name, ds.signing_order, ds.countersigned_at,
         ds.countersigned_by_name, ds.countersign_role, ds.signature_status as status,
         ds.investor_name as party_name, ds.document_content, ds.released_to_client_at, ds.sent_at
    into doc from "prj_X-ZoVQv6LKXT".document_signatures ds where ds.id = p_document_id;

  if not found then
    select ls.id, ls.document_name, ls.signing_order, ls.countersigned_at,
           ls.countersigned_by_name, ls.countersign_role, ls.status as status,
           coalesce(lc.name, ls.signer_name) as party_name, ls.document_content,
           ls.released_to_client_at, ls.sent_at
      into doc from "prj_X-ZoVQv6LKXT".landlord_signatures ls
      left join "prj_X-ZoVQv6LKXT".landlord_contacts lc on lc.id = ls.landlord_id
     where ls.id = p_document_id;
    if found then is_landlord := true; end if;
  end if;

  if doc.id is null then return jsonb_build_object('ok', false, 'error', 'Document not found.'); end if;

  company_first := coalesce(doc.signing_order, 'client_first') = 'company_first';
  v_status := doc.status;
  v_party_name := coalesce(doc.party_name, 'the counterparty');

  if doc.countersigned_at is not null then
    return jsonb_build_object('ok', false, 'error',
      format('Already signed by %s. Nothing to do.', coalesce(doc.countersigned_by_name, 'a colleague')));
  end if;

  if v_status in ('declined','cancelled') then
    return jsonb_build_object('ok', false, 'error',
      format('This document was %s. There is nothing to countersign.', v_status));
  end if;

  if not company_first and v_status <> 'signed' then
    return jsonb_build_object('ok', false, 'error',
      case when is_landlord then 'The landlord has not signed this yet. The company signs second on this document.'
           else 'The client has not signed this yet. The company signs second on this document.' end);
  end if;

  select * into who from "prj_X-ZoVQv6LKXT".staff_users where id = p_staff_id and is_active;
  if who is null then return jsonb_build_object('ok', false, 'error', 'Not an active staff member.'); end if;

  bag := lower(concat_ws(' ', who.role, who.department, array_to_string(coalesce(who.roles,'{}'), ' ')));
  may := case
    when doc.countersign_role = 'owner' then bag like '%owner%'
    when doc.countersign_role = 'setup_or_success'
      then bag like '%owner%' or bag like '%setup%' or bag like '%success%' or bag like '%admin%'
    else bag like '%owner%' end;

  if not may then
    return jsonb_build_object('ok', false, 'error',
      case when doc.countersign_role = 'owner' then 'This one is for the owner to sign.'
           else 'You do not have permission to sign this document.' end);
  end if;

  if v_name = '' then return jsonb_build_object('ok', false, 'error', 'Type your full name to sign.'); end if;

  v_block := E'\n\n=====================================================\nSIGNED FOR THE COMPANY\n\n/s/ ' || v_name ||
    E'\nFor and on behalf of Set Up Your Place LLC (DBA: Access Your Place)\nDate: ' || to_char(now(),'DD Month YYYY') ||
    E'\n\nSigned electronically through the Access Your Place staff portal.\n=====================================================';

  if is_landlord then
    update "prj_X-ZoVQv6LKXT".landlord_signatures
       set countersigned_by = p_staff_id, countersigned_by_name = v_name, countersigned_at = now(),
           released_to_client_at = case when company_first then now() else released_to_client_at end,
           sent_at = case when company_first then coalesce(sent_at, now()) else sent_at end,
           document_content = coalesce(document_content,'') || v_block, updated_at = now()
     where id = p_document_id and countersigned_at is null;
  else
    update "prj_X-ZoVQv6LKXT".document_signatures
       set countersigned_by = p_staff_id, countersigned_by_name = v_name, countersigned_at = now(),
           released_to_client_at = case when company_first then now() else released_to_client_at end,
           sent_at = case when company_first then coalesce(sent_at, now()) else sent_at end,
           document_content = coalesce(document_content,'') || v_block, updated_at = now()
     where id = p_document_id and countersigned_at is null;
  end if;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Someone countersigned this a moment ago. Reload the queue.');
  end if;

  insert into "prj_X-ZoVQv6LKXT".staff_notifications (type, title, message, metadata, target_role, priority)
  values (
    case when is_landlord then 'landlord_document_countersigned' else 'document_countersigned' end,
    'A document was countersigned',
    format('%s countersigned "%s" for %s.', v_name, doc.document_name, v_party_name),
    jsonb_build_object('document_id', p_document_id,
                       'party_kind', case when is_landlord then 'landlord' else 'investor' end),
    'owner', 'normal');

  return jsonb_build_object('ok', true, 'document', doc.document_name,
    'party_kind', case when is_landlord then 'landlord' else 'investor' end,
    'client', v_party_name, 'counterparty', v_party_name, 'signed_by', v_name,
    'released_to_client', company_first,
    'note', case when company_first then format('Signed and sent to %s for their signature.', v_party_name)
                 else 'Fully executed.' end);
end $function$;
revoke execute on function public.ayp_countersign_document(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.ayp_countersign_document(uuid, uuid, text) to service_role;

-- staff_notifications: several writers sent a "data" column; the trigger folds it into
-- metadata so those writes stopped failing. manage-landlord-portal now writes metadata.
alter table "prj_X-ZoVQv6LKXT".staff_notifications add column if not exists data jsonb;
CREATE OR REPLACE FUNCTION "prj_X-ZoVQv6LKXT".staff_notifications_fold_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'prj_X-ZoVQv6LKXT', 'pg_temp'
AS $function$
begin
  if new.data is not null and new.data <> '{}'::jsonb then
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || new.data;
  end if;
  new.data := null;
  return new;
end $function$;
drop trigger if exists staff_notifications_fold_data_trg on "prj_X-ZoVQv6LKXT".staff_notifications;
CREATE TRIGGER staff_notifications_fold_data_trg BEFORE INSERT OR UPDATE ON "prj_X-ZoVQv6LKXT".staff_notifications FOR EACH ROW EXECUTE FUNCTION "prj_X-ZoVQv6LKXT".staff_notifications_fold_data();

-- Delivery log for deliver-document: one row per document sent, with its SHA-256.
create table if not exists "prj_X-ZoVQv6LKXT".document_deliveries (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'other',
  recipient_kind text not null default 'other',
  recipient_email text not null,
  recipient_name text,
  landlord_id uuid,
  investor_id uuid,
  subject text,
  document_name text,
  bucket text,
  file_path text,
  file_size integer,
  sha256 text,
  download_link text,
  link_expires_at timestamptz,
  attached boolean not null default false,
  from_email text,
  resend_id text,
  status text not null default 'queued',
  error_message text,
  sent_by uuid,
  sent_by_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists document_deliveries_status_idx on "prj_X-ZoVQv6LKXT".document_deliveries (status, created_at desc);
create index if not exists document_deliveries_recipient_idx on "prj_X-ZoVQv6LKXT".document_deliveries (recipient_email, created_at desc);
create index if not exists document_deliveries_landlord_idx on "prj_X-ZoVQv6LKXT".document_deliveries (landlord_id, created_at desc);
alter table "prj_X-ZoVQv6LKXT".document_deliveries enable row level security;
create or replace view public.document_deliveries as select * from "prj_X-ZoVQv6LKXT".document_deliveries;

-- 26 September: the view had been granted to anon (read) and authenticated (write). It
-- runs as its owner, so that exposed every recipient and a 7-day download link for every
-- contract sent. Only deliver-document (service role) uses it.
revoke all on public.document_deliveries from anon, authenticated;
grant select, insert, update on public.document_deliveries to service_role;

-- Same day: corporate_applications and landlord_documents were readable by anon through
-- their public views. Only manage-landlord-portal (service role) reads them.
revoke all on public.corporate_applications from anon, authenticated;
revoke all on public.landlord_documents from anon, authenticated;
grant select, insert, update, delete on public.corporate_applications to service_role;
grant select, insert, update, delete on public.landlord_documents to service_role;

notify pgrst, 'reload schema';
