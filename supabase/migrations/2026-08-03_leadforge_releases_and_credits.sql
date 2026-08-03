-- LeadForge: real released properties + exactly-once, race-safe credit debit.
-- Applied live 2026-08-03 (project adcbrclppmnguzkzwiys) and verified end-to-end
-- (idempotent no-double-charge, FOR UPDATE SKIP LOCKED race safety, staff bypass,
-- correct debit + audit ledger). A release consumes one discrete $62.50 LeadForge credit
-- unit (20 per $1,250); balance = sum(amount) of active, non-expired investor_credits.
-- investor_credit_transactions.transaction_type is constrained to 'credit' | 'debit'.
-- Money RPCs are execute-locked to service_role only (no user can self-grant/self-debit).

create table if not exists "prj_X-ZoVQv6LKXT".leadforge_releases (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null,
  idempotency_key text not null,
  zip_code text,
  city text,
  state text,
  title text,
  source_url text,
  monthly_rent numeric,
  bedrooms integer,
  bathrooms numeric,
  operation_fit text,
  analysis jsonb,
  credit_amount numeric not null default 62.50,
  credit_id uuid,
  credit_transaction_id uuid,
  status text not null default 'released',
  released_by text not null default 'operator',
  created_at timestamptz not null default now(),
  constraint leadforge_releases_idem_uk unique (investor_id, idempotency_key)
);

create index if not exists leadforge_releases_investor_idx
  on "prj_X-ZoVQv6LKXT".leadforge_releases (investor_id, created_at desc);

-- Balance (release-credit count + total active dollars).
create or replace function public.leadforge_balance(p_investor_id uuid)
returns jsonb language sql security definer
set search_path = "prj_X-ZoVQv6LKXT", public as $$
  select jsonb_build_object(
    'release_credits', (select count(*) from "prj_X-ZoVQv6LKXT".investor_credits
       where investor_id = p_investor_id and credit_status = 'active'
         and credit_type in ('leadforge','search','leadforge_search')
         and (expires_at is null or expires_at > now())),
    'dollar_balance', (select coalesce(sum(amount),0) from "prj_X-ZoVQv6LKXT".investor_credits
       where investor_id = p_investor_id and credit_status = 'active'
         and (expires_at is null or expires_at > now())));
$$;

-- Grant N LeadForge release credits after a confirmed purchase (20 units = $1,250). Purchase = 'credit'.
create or replace function public.leadforge_grant_credits(
  p_investor_id uuid, p_units integer default 20, p_unit_cost numeric default 62.50,
  p_created_by text default 'leadforge_purchase', p_reference text default null
) returns jsonb language plpgsql security definer
set search_path = "prj_X-ZoVQv6LKXT", public as $$
declare i integer;
begin
  if p_investor_id is null then return jsonb_build_object('success', false, 'error', 'missing_investor'); end if;
  if p_units is null or p_units < 1 then return jsonb_build_object('success', false, 'error', 'invalid_units'); end if;
  for i in 1..p_units loop
    insert into "prj_X-ZoVQv6LKXT".investor_credits
      (investor_id, amount, credit_type, credit_status, source_description, created_by)
    values (p_investor_id, p_unit_cost, 'leadforge', 'active',
       coalesce('LeadForge credit purchase ' || p_reference, 'LeadForge credit purchase'), p_created_by);
  end loop;
  insert into "prj_X-ZoVQv6LKXT".investor_credit_transactions
    (investor_id, transaction_type, amount, description, reference_type, reference_id)
  values (p_investor_id, 'credit', p_units * p_unit_cost,
     'Purchased ' || p_units || ' LeadForge release credits', 'leadforge_purchase', p_reference);
  return jsonb_build_object('success', true, 'granted_units', p_units, 'unit_cost', p_unit_cost, 'total', p_units * p_unit_cost);
end $$;

-- Atomic release: claim one active LeadForge credit (or bypass for staff), record the release,
-- write the audit ledger. Exactly-once via the (investor_id, idempotency_key) unique key. Release = 'debit'.
create or replace function public.leadforge_release(
  p_investor_id uuid, p_idempotency_key text, p_listing jsonb, p_is_staff boolean default false
) returns jsonb language plpgsql security definer
set search_path = "prj_X-ZoVQv6LKXT", public as $$
declare
  v_unit_cost numeric := 62.50;
  v_existing "prj_X-ZoVQv6LKXT".leadforge_releases%rowtype;
  v_credit_id uuid; v_release_id uuid; v_txn_id uuid; v_balance numeric;
begin
  if p_investor_id is null or coalesce(p_idempotency_key, '') = '' then
    return jsonb_build_object('success', false, 'error', 'missing_params'); end if;

  select * into v_existing from "prj_X-ZoVQv6LKXT".leadforge_releases
    where investor_id = p_investor_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('success', true, 'already_released', true, 'charged', false,
      'release_id', v_existing.id, 'source_url', v_existing.source_url,
      'address', v_existing.title, 'analysis', v_existing.analysis); end if;

  if p_is_staff then
    insert into "prj_X-ZoVQv6LKXT".leadforge_releases
      (investor_id, idempotency_key, zip_code, city, state, title, source_url,
       monthly_rent, bedrooms, bathrooms, operation_fit, analysis, credit_amount, status, released_by)
    values (p_investor_id, p_idempotency_key, p_listing->>'zip_code', p_listing->>'city', p_listing->>'state',
       p_listing->>'title', p_listing->>'source_url',
       nullif(p_listing->>'monthly_rent','')::numeric, nullif(p_listing->>'bedrooms','')::integer,
       nullif(p_listing->>'bathrooms','')::numeric, p_listing->>'operation_fit', p_listing->'analysis',
       0, 'released', 'staff')
    returning id into v_release_id;
    return jsonb_build_object('success', true, 'charged', false, 'staff', true, 'release_id', v_release_id,
      'source_url', p_listing->>'source_url', 'address', p_listing->>'title', 'analysis', p_listing->'analysis'); end if;

  update "prj_X-ZoVQv6LKXT".investor_credits
     set credit_status = 'used', used_at = now(), used_for = 'leadforge_release', updated_at = now()
   where id = (select id from "prj_X-ZoVQv6LKXT".investor_credits
      where investor_id = p_investor_id and credit_status = 'active'
        and credit_type in ('leadforge','search','leadforge_search')
        and (expires_at is null or expires_at > now())
      order by created_at asc for update skip locked limit 1)
  returning id into v_credit_id;

  if v_credit_id is null then
    return jsonb_build_object('success', false, 'error', 'insufficient_credits', 'unit_cost', v_unit_cost); end if;

  insert into "prj_X-ZoVQv6LKXT".leadforge_releases
    (investor_id, idempotency_key, zip_code, city, state, title, source_url,
     monthly_rent, bedrooms, bathrooms, operation_fit, analysis, credit_amount, credit_id, status, released_by)
  values (p_investor_id, p_idempotency_key, p_listing->>'zip_code', p_listing->>'city', p_listing->>'state',
     p_listing->>'title', p_listing->>'source_url',
     nullif(p_listing->>'monthly_rent','')::numeric, nullif(p_listing->>'bedrooms','')::integer,
     nullif(p_listing->>'bathrooms','')::numeric, p_listing->>'operation_fit', p_listing->'analysis',
     v_unit_cost, v_credit_id, 'released', 'operator')
  returning id into v_release_id;

  select coalesce(sum(amount),0) into v_balance from "prj_X-ZoVQv6LKXT".investor_credits
   where investor_id = p_investor_id and credit_status = 'active' and (expires_at is null or expires_at > now());

  insert into "prj_X-ZoVQv6LKXT".investor_credit_transactions
    (investor_id, transaction_type, amount, description, reference_type, reference_id, balance_after)
  values (p_investor_id, 'debit', v_unit_cost, 'LeadForge property release',
     'leadforge_release', v_release_id::text, v_balance)
  returning id into v_txn_id;

  insert into "prj_X-ZoVQv6LKXT".investor_credit_usage (investor_id, amount, reason)
    values (p_investor_id, v_unit_cost, 'leadforge_release');

  update "prj_X-ZoVQv6LKXT".leadforge_releases set credit_transaction_id = v_txn_id where id = v_release_id;

  return jsonb_build_object('success', true, 'charged', true, 'unit_cost', v_unit_cost,
    'release_id', v_release_id, 'credit_id', v_credit_id, 'balance_after', v_balance,
    'source_url', p_listing->>'source_url', 'address', p_listing->>'title', 'analysis', p_listing->'analysis');
end $$;

revoke all on function public.leadforge_release(uuid, text, jsonb, boolean) from public;
revoke all on function public.leadforge_grant_credits(uuid, integer, numeric, text, text) from public;
revoke all on function public.leadforge_balance(uuid) from public;
grant execute on function public.leadforge_release(uuid, text, jsonb, boolean) to service_role;
grant execute on function public.leadforge_grant_credits(uuid, integer, numeric, text, text) to service_role;
grant execute on function public.leadforge_balance(uuid) to service_role;
