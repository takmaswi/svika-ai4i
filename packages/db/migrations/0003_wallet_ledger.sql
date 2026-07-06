-- 0003 wallet ledger
-- Money is a double entry, append only ledger. There is no balance column
-- anywhere; a balance is always sum(postings) for an account. Every movement
-- is a transaction with two or more postings that sum to zero, enforced by a
-- deferred constraint trigger. Nothing here can be updated or deleted.
--
-- Account kinds:
--   rider_wallet        rider USD credit (the change problem money)
--   conductor_wallet    conductor commission earnings
--   owner_wallet        owner fare revenue
--   platform_escrow     fare held between purchase and redemption
--   platform_fees       platform fee income (rate is 0 until a real
--                       decision is made; the account exists so the split
--                       is one posting away)
--   external_cash       the boundary account absorbing value entering or
--                       leaving the digital ledger (topups, payouts). It is
--                       the mirror side of money creation, so the sum of all
--                       postings in the system is always exactly zero.
-- RLS is enabled on every table in this migration, in this migration.

create type public.ledger_account_kind as enum (
  'rider_wallet',
  'conductor_wallet',
  'owner_wallet',
  'platform_escrow',
  'platform_fees',
  'external_cash'
);

create type public.ledger_txn_kind as enum (
  'topup',
  'ticket_purchase',
  'fare_settlement',
  'refund',
  'adjustment'
);

create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  kind public.ledger_account_kind not null,
  profile_id uuid references public.profiles (id) on delete restrict,
  currency text not null default 'USD' check (currency = 'USD'),
  created_at timestamptz not null default now(),
  -- platform accounts have no profile; personal accounts must have one
  check (
    (kind in ('platform_escrow', 'platform_fees', 'external_cash'))
    = (profile_id is null)
  ),
  unique (profile_id, kind)
);

-- exactly one of each platform account
create unique index ledger_accounts_platform_singleton
  on public.ledger_accounts (kind)
  where profile_id is null;

alter table public.ledger_accounts enable row level security;

create policy "ledger_accounts select own"
  on public.ledger_accounts for select
  to authenticated
  using (profile_id = (select auth.uid()));

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  kind public.ledger_txn_kind not null,
  ticket_id uuid, -- FK added in 0004 (tickets are created there)
  memo text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.ledger_transactions enable row level security;

create table public.ledger_postings (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.ledger_transactions (id) on delete restrict,
  account_id uuid not null references public.ledger_accounts (id) on delete restrict,
  amount_cents bigint not null check (amount_cents <> 0),
  created_at timestamptz not null default now()
);

create index ledger_postings_account_idx on public.ledger_postings (account_id);
create index ledger_postings_transaction_idx on public.ledger_postings (transaction_id);

alter table public.ledger_postings enable row level security;

create policy "ledger_postings select own accounts"
  on public.ledger_postings for select
  to authenticated
  using (
    account_id in (
      select id from public.ledger_accounts
      where profile_id = (select auth.uid())
    )
  );

-- a user may read a transaction they are party to; security definer helper
-- avoids RLS recursion between transactions and postings
create or replace function public.is_party_to_transaction(p_txn uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ledger_postings p
    join public.ledger_accounts a on a.id = p.account_id
    where p.transaction_id = p_txn
      and a.profile_id = auth.uid()
  );
$$;

create policy "ledger_transactions select party"
  on public.ledger_transactions for select
  to authenticated
  using (public.is_party_to_transaction(id));

-- append only: history is never rewritten, even by the service role
create trigger ledger_transactions_append_only
  before update or delete on public.ledger_transactions
  for each row execute function public.forbid_mutation();

create trigger ledger_postings_append_only
  before update or delete on public.ledger_postings
  for each row execute function public.forbid_mutation();

-- the double entry invariant, checked at commit time:
--   every transaction has at least two postings and sums to zero;
--   personal accounts (wallets) can never go negative.
create or replace function public.assert_transaction_balanced()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sum bigint;
  v_count integer;
  v_kind public.ledger_account_kind;
  v_balance bigint;
begin
  select coalesce(sum(amount_cents), 0), count(*)
  into v_sum, v_count
  from public.ledger_postings
  where transaction_id = new.transaction_id;

  if v_count < 2 then
    raise exception 'ledger: transaction % has fewer than two postings', new.transaction_id;
  end if;
  if v_sum <> 0 then
    raise exception 'ledger: transaction % does not sum to zero (off by %)', new.transaction_id, v_sum;
  end if;

  if new.amount_cents < 0 then
    select kind into v_kind from public.ledger_accounts where id = new.account_id;
    if v_kind in ('rider_wallet', 'conductor_wallet', 'owner_wallet') then
      select coalesce(sum(amount_cents), 0) into v_balance
      from public.ledger_postings
      where account_id = new.account_id;
      if v_balance < 0 then
        raise exception 'ledger: account % would go negative (%)', new.account_id, v_balance;
      end if;
    end if;
  end if;

  return null;
end;
$$;

create constraint trigger ledger_balanced
  after insert on public.ledger_postings
  deferrable initially deferred
  for each row execute function public.assert_transaction_balanced();

-- balances are always derived, never stored
create view public.account_balances
with (security_invoker = on) as
select
  a.id as account_id,
  a.profile_id,
  a.kind,
  a.currency,
  coalesce(sum(p.amount_cents), 0)::bigint as balance_cents
from public.ledger_accounts a
left join public.ledger_postings p on p.account_id = a.id
group by a.id;

-- the three platform accounts are schema fixtures
insert into public.ledger_accounts (kind, profile_id)
values
  ('platform_escrow', null),
  ('platform_fees', null),
  ('external_cash', null);

-- every new profile gets a rider wallet
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ledger_accounts (kind, profile_id)
  values ('rider_wallet', new.id)
  on conflict (profile_id, kind) do nothing;
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- topups enter through payment adapters (mocked in P0). Only the service
-- role may record one; execute is revoked from every client facing role.
create or replace function public.record_topup(
  p_profile uuid,
  p_amount_cents bigint,
  p_memo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet uuid;
  v_cash uuid;
  v_txn uuid;
begin
  if p_amount_cents <= 0 then
    raise exception 'topup must be a positive amount';
  end if;

  select id into v_wallet
  from public.ledger_accounts
  where profile_id = p_profile and kind = 'rider_wallet';
  if v_wallet is null then
    raise exception 'no rider wallet for profile %', p_profile;
  end if;

  select id into v_cash
  from public.ledger_accounts
  where kind = 'external_cash' and profile_id is null;

  insert into public.ledger_transactions (kind, memo, created_by)
  values ('topup', p_memo, p_profile)
  returning id into v_txn;

  insert into public.ledger_postings (transaction_id, account_id, amount_cents)
  values
    (v_txn, v_wallet, p_amount_cents),
    (v_txn, v_cash, -p_amount_cents);

  return v_txn;
end;
$$;

revoke execute on function public.record_topup(uuid, bigint, text) from public, anon, authenticated;

-- clients never write the ledger directly; money moves only through
-- security definer functions
revoke insert, update, delete on table public.ledger_accounts, public.ledger_transactions, public.ledger_postings from authenticated, anon;
