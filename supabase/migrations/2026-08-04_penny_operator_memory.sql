-- Penny's per-operator durable memory: markets, strategy, portfolio, budget, experience, goals.
-- Read each turn to tailor advice; enriched over time by the operator-memory edge function.
-- Security: RLS ON with NO policies, so anon/authenticated cannot read/write ANY row (no operator
-- can see another's portfolio or budget). Only the service role (bypasses RLS) touches it.
create table if not exists public.penny_operator_memory (
  user_id     text primary key,
  memory      jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

alter table public.penny_operator_memory enable row level security;

comment on table public.penny_operator_memory is
  'Per-operator durable memory Penny reads each turn (markets, strategies, portfolio, budget, experience, goals) and enriches over time. Service-role only; RLS on with no policies so no operator can read another''s memory. Transparency/editing flows through the operator-memory edge function.';
