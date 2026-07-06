-- 0011 credit transfers: send credit, another rider claims it
-- Matches the documented street practice of pairing strangers on one note:
-- wallet credit can be handed to another person. Money parks in platform
-- escrow between send and claim, so the ledger never has a moment where
-- value is unaccounted for. Transfers are event sourced like tickets
-- (transfer_events is append only; current status is the latest event).
-- Claiming is by a 6 character code from an unambiguous alphabet, rate
-- limited with every attempt logged (same posture as board codes).

alter type public.ledger_txn_kind add value if not exists 'transfer_send';
alter type public.ledger_txn_kind add value if not exists 'transfer_claim';
alter type public.ledger_txn_kind add value if not exists 'transfer_cancel';

create type public.transfer_event_type as enum ('sent', 'claimed', 'cancelled');

create table public.credit_transfers (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  claim_code text not null unique check (claim_code ~ '^[2-9A-HJ-NP-Z]{6}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.credit_transfers enable row level security;

create policy "credit_transfers select own"
  on public.credit_transfers for select
  to authenticated
  using (sender_id = (select auth.uid()));

create trigger credit_transfers_append_only
  before update or delete on public.credit_transfers
  for each row execute function public.forbid_mutation();

create table public.transfer_events (
  id bigint generated always as identity primary key,
  transfer_id uuid not null references public.credit_transfers (id) on delete restrict,
  event_type public.transfer_event_type not null,
  actor_profile_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index transfer_events_transfer_idx
  on public.transfer_events (transfer_id, created_at desc);

alter table public.transfer_events enable row level security;

-- sender always sees the history; the claimer sees events they acted in
create policy "transfer_events select party"
  on public.transfer_events for select
  to authenticated
  using (
    actor_profile_id = (select auth.uid())
    or exists (
      select 1 from public.credit_transfers ct
      where ct.id = transfer_id
        and ct.sender_id = (select auth.uid())
    )
  );

create trigger transfer_events_append_only
  before update or delete on public.transfer_events
  for each row execute function public.forbid_mutation();

-- every claim attempt is logged; the rate limiter reads this table
create table public.transfer_claim_attempts (
  id bigint generated always as identity primary key,
  claimer_id uuid not null references public.profiles (id) on delete restrict,
  code_entered text not null,
  outcome text not null check (
    outcome in ('success', 'invalid_code', 'already_claimed', 'rate_limited')
  ),
  transfer_id uuid references public.credit_transfers (id),
  attempted_at timestamptz not null default now()
);

create index transfer_claim_attempts_rate_idx
  on public.transfer_claim_attempts (claimer_id, attempted_at desc);

alter table public.transfer_claim_attempts enable row level security;

create policy "transfer_claim_attempts select own"
  on public.transfer_claim_attempts for select
  to authenticated
  using (claimer_id = (select auth.uid()));

create trigger transfer_claim_attempts_append_only
  before update or delete on public.transfer_claim_attempts
  for each row execute function public.forbid_mutation();

-- ledger transactions can reference the transfer they settle
alter table public.ledger_transactions
  add column transfer_id uuid references public.credit_transfers (id) on delete restrict;

revoke insert, update, delete on table public.credit_transfers, public.transfer_events, public.transfer_claim_attempts from authenticated, anon;

-- ---------------------------------------------------------------------------
-- send_credit: park credit in escrow under a claim code
-- ---------------------------------------------------------------------------
create or replace function public.send_credit(p_amount_cents integer)
returns table (transfer_id uuid, claim_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender uuid := (select auth.uid());
  v_wallet uuid;
  v_escrow uuid;
  v_balance bigint;
  v_code text;
  v_transfer uuid;
  v_txn uuid;
  v_expires timestamptz := now() + interval '7 days';
  v_alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_bytes bytea;
  v_tries integer := 0;
begin
  if v_sender is null then
    raise exception 'not authenticated';
  end if;
  if p_amount_cents is null or p_amount_cents < 10 then
    raise exception 'amount too small to send';
  end if;

  select id into v_wallet
  from public.ledger_accounts
  where profile_id = v_sender and kind = 'rider_wallet';
  if v_wallet is null then
    raise exception 'no rider wallet';
  end if;

  select id into v_escrow
  from public.ledger_accounts
  where kind = 'platform_escrow' and profile_id is null;

  perform pg_advisory_xact_lock(hashtextextended(v_wallet::text, 42));

  select coalesce(sum(amount_cents), 0) into v_balance
  from public.ledger_postings
  where account_id = v_wallet;
  if v_balance < p_amount_cents then
    raise exception 'insufficient wallet balance';
  end if;

  loop
    v_bytes := extensions.gen_random_bytes(6);
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
    end loop;
    begin
      insert into public.credit_transfers (sender_id, amount_cents, claim_code, expires_at)
      values (v_sender, p_amount_cents, v_code, v_expires)
      returning id into v_transfer;
      exit;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries >= 10 then
        raise exception 'could not allocate a claim code, try again';
      end if;
    end;
  end loop;

  insert into public.transfer_events (transfer_id, event_type, actor_profile_id)
  values (v_transfer, 'sent', v_sender);

  insert into public.ledger_transactions (kind, transfer_id, memo, created_by)
  values ('transfer_send', v_transfer, 'credit sent for claim', v_sender)
  returning id into v_txn;

  insert into public.ledger_postings (transaction_id, account_id, amount_cents)
  values
    (v_txn, v_wallet, -p_amount_cents),
    (v_txn, v_escrow, p_amount_cents);

  return query select v_transfer, v_code, v_expires;
end;
$$;

revoke execute on function public.send_credit(integer) from public, anon;
grant execute on function public.send_credit(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- claim_credit: escrow to the claimer's wallet, rate limited, logged
-- ---------------------------------------------------------------------------
create or replace function public.claim_credit(p_code text)
returns table (outcome text, amount_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimer uuid := (select auth.uid());
  v_transfer public.credit_transfers%rowtype;
  v_failures integer;
  v_status public.transfer_event_type;
  v_wallet uuid;
  v_escrow uuid;
  v_txn uuid;
begin
  if v_claimer is null then
    raise exception 'not authenticated';
  end if;

  -- rate limit: at most 5 failed attempts in the last 10 minutes
  select count(*) into v_failures
  from public.transfer_claim_attempts a
  where a.claimer_id = v_claimer
    and a.outcome <> 'success'
    and a.attempted_at > now() - interval '10 minutes';
  if v_failures >= 5 then
    insert into public.transfer_claim_attempts (claimer_id, code_entered, outcome)
    values (v_claimer, p_code, 'rate_limited');
    return query select 'rate_limited'::text, null::integer;
    return;
  end if;

  select * into v_transfer
  from public.credit_transfers ct
  where ct.claim_code = upper(trim(p_code))
    and ct.expires_at > now();
  if not found then
    insert into public.transfer_claim_attempts (claimer_id, code_entered, outcome)
    values (v_claimer, p_code, 'invalid_code');
    return query select 'invalid_code'::text, null::integer;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_transfer.id::text, 11));

  select e.event_type into v_status
  from public.transfer_events e
  where e.transfer_id = v_transfer.id
  order by e.created_at desc, e.id desc
  limit 1;
  if v_status is distinct from 'sent' then
    insert into public.transfer_claim_attempts (claimer_id, code_entered, outcome, transfer_id)
    values (v_claimer, p_code, 'already_claimed', v_transfer.id);
    return query select 'already_claimed'::text, null::integer;
    return;
  end if;

  select id into v_wallet
  from public.ledger_accounts
  where profile_id = v_claimer and kind = 'rider_wallet';
  if v_wallet is null then
    raise exception 'no rider wallet';
  end if;

  select id into v_escrow
  from public.ledger_accounts
  where kind = 'platform_escrow' and profile_id is null;

  insert into public.transfer_events (transfer_id, event_type, actor_profile_id)
  values (v_transfer.id, 'claimed', v_claimer);

  insert into public.ledger_transactions (kind, transfer_id, memo, created_by)
  values ('transfer_claim', v_transfer.id, 'credit claimed', v_claimer)
  returning id into v_txn;

  insert into public.ledger_postings (transaction_id, account_id, amount_cents)
  values
    (v_txn, v_escrow, -v_transfer.amount_cents),
    (v_txn, v_wallet, v_transfer.amount_cents);

  insert into public.transfer_claim_attempts (claimer_id, code_entered, outcome, transfer_id)
  values (v_claimer, p_code, 'success', v_transfer.id);

  return query select 'success'::text, v_transfer.amount_cents;
end;
$$;

revoke execute on function public.claim_credit(text) from public, anon;
grant execute on function public.claim_credit(text) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_transfer: the sender takes unclaimed credit back
-- ---------------------------------------------------------------------------
create or replace function public.cancel_transfer(p_transfer uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender uuid := (select auth.uid());
  v_transfer public.credit_transfers%rowtype;
  v_status public.transfer_event_type;
  v_wallet uuid;
  v_escrow uuid;
  v_txn uuid;
begin
  if v_sender is null then
    raise exception 'not authenticated';
  end if;

  select * into v_transfer
  from public.credit_transfers ct
  where ct.id = p_transfer and ct.sender_id = v_sender;
  if not found then
    raise exception 'unknown transfer';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_transfer.id::text, 11));

  select e.event_type into v_status
  from public.transfer_events e
  where e.transfer_id = v_transfer.id
  order by e.created_at desc, e.id desc
  limit 1;
  if v_status is distinct from 'sent' then
    raise exception 'transfer is not open';
  end if;

  select id into v_wallet
  from public.ledger_accounts
  where profile_id = v_sender and kind = 'rider_wallet';

  select id into v_escrow
  from public.ledger_accounts
  where kind = 'platform_escrow' and profile_id is null;

  insert into public.transfer_events (transfer_id, event_type, actor_profile_id)
  values (v_transfer.id, 'cancelled', v_sender);

  insert into public.ledger_transactions (kind, transfer_id, memo, created_by)
  values ('transfer_cancel', v_transfer.id, 'transfer cancelled by sender', v_sender)
  returning id into v_txn;

  insert into public.ledger_postings (transaction_id, account_id, amount_cents)
  values
    (v_txn, v_escrow, -v_transfer.amount_cents),
    (v_txn, v_wallet, v_transfer.amount_cents);
end;
$$;

revoke execute on function public.cancel_transfer(uuid) from public, anon;
grant execute on function public.cancel_transfer(uuid) to authenticated;
