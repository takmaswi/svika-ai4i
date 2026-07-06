-- 0014 offline boarding (P2)
-- The conductor's phone clears fares with no network. Server side that means
-- four things, all here:
--
--   1. pull_offline_cache: the device downloads the PENDING board codes for
--      its route + direction as per-ticket SALTED SHA-256 HASHES, never
--      plaintext. A stolen phone holds no code list; matching an entered
--      code is one hash on the device, recovering codes from the dump means
--      brute forcing each ticket separately, for codes that only work on one
--      route + direction inside a short window. Every pull is audit logged.
--
--   2. sync_offline_redemption: queued offline redemptions replay one by one.
--      Each carries a client generated event id; offline_sync_receipts makes
--      the call idempotent, so a queue that drops mid-flush and replays can
--      never settle money twice. Settlement and the ticket event append are
--      THE SAME code path as online redemption (private.apply_redemption),
--      so the ledger rules cannot drift between the two.
--
--   3. Conflicts: the same code redeemed twice while offline resolves first
--      sync wins; the second sync gets 'already_redeemed' and an
--      anomaly_flags row (a pattern for the owner's watchdog, ids in detail,
--      no person named or accused in any narrative built on it).
--
--   4. Clock discipline: the device's claimed redemption time is validated
--      against the code's validity window, clamped and flagged when it sits
--      in the server's future, and refused (money untouched) when the sync
--      arrives beyond the grace window. The server clock is the only clock
--      money trusts; the device clock is testimony, recorded in the event
--      detail.
--
-- Nothing here weakens P0/P1 law: RLS on every new table in this migration,
-- clients get no direct write path, history stays append only, money moves
-- only through balanced double entry postings.

-- ---------------------------------------------------------------------------
-- anomaly_flags: intelligence output surface (planned since P0, first real
-- producer is the offline conflict path; Spine 3 joins it in P4).
-- Flags describe patterns on tickets/routes; they never name a person.
-- ---------------------------------------------------------------------------
create table public.anomaly_flags (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'offline_duplicate_redemption',
    'offline_duplicate_change',
    'clock_skew',
    'late_sync',
    'stale_offline_event'
  )),
  severity text not null default 'warning'
    check (severity in ('info', 'warning', 'critical')),
  ticket_id uuid references public.tickets (id) on delete restrict,
  route_id uuid references public.routes (id) on delete restrict,
  owner_id uuid references public.owners (id) on delete restrict,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index anomaly_flags_owner_idx on public.anomaly_flags (owner_id, created_at desc);
create index anomaly_flags_ticket_idx on public.anomaly_flags (ticket_id);

alter table public.anomaly_flags enable row level security;

-- the owner whose fleet the flag concerns can read it; nobody writes directly
create policy "anomaly_flags select own fleet"
  on public.anomaly_flags for select
  to authenticated
  using (
    owner_id in (
      select id from public.owners where profile_id = (select auth.uid())
    )
  );

create trigger anomaly_flags_append_only
  before update or delete on public.anomaly_flags
  for each row execute function public.forbid_mutation();

-- ---------------------------------------------------------------------------
-- offline_sync_receipts: idempotency for replayed queues. One row per client
-- generated event id; a second sync of the same event returns the stored
-- outcome and touches nothing.
-- ---------------------------------------------------------------------------
create table public.offline_sync_receipts (
  client_event_id uuid primary key,
  conductor_id uuid not null references public.conductors (id) on delete restrict,
  event_kind text not null check (event_kind in ('redeem', 'change_credit')),
  outcome text not null,
  ticket_id uuid references public.tickets (id) on delete restrict,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index offline_sync_receipts_conductor_idx
  on public.offline_sync_receipts (conductor_id, created_at desc);

alter table public.offline_sync_receipts enable row level security;

create policy "sync receipts select own"
  on public.offline_sync_receipts for select
  to authenticated
  using (
    conductor_id in (
      select id from public.conductors
      where profile_id = (select auth.uid())
    )
  );

create trigger offline_sync_receipts_append_only
  before update or delete on public.offline_sync_receipts
  for each row execute function public.forbid_mutation();

-- ---------------------------------------------------------------------------
-- cache_pulls: audit log of who downloaded which route cache when. A
-- conductor cracking hashes at scale shows up here first.
-- ---------------------------------------------------------------------------
create table public.cache_pulls (
  id bigint generated always as identity primary key,
  conductor_id uuid not null references public.conductors (id) on delete restrict,
  route_id uuid not null references public.routes (id) on delete restrict,
  direction public.route_direction not null,
  row_count integer not null,
  pulled_at timestamptz not null default now()
);

create index cache_pulls_conductor_idx on public.cache_pulls (conductor_id, pulled_at desc);

alter table public.cache_pulls enable row level security;

create policy "cache pulls select own"
  on public.cache_pulls for select
  to authenticated
  using (
    conductor_id in (
      select id from public.conductors
      where profile_id = (select auth.uid())
    )
  );

create trigger cache_pulls_append_only
  before update or delete on public.cache_pulls
  for each row execute function public.forbid_mutation();

-- ---------------------------------------------------------------------------
-- code_redemption_attempts grows a client attempt id (dedupe for replayed
-- offline logs; unique ignores NULLs so online attempts are untouched) and
-- the 'sync_expired' outcome (a queued redemption that arrived too late to
-- settle).
-- ---------------------------------------------------------------------------
alter table public.code_redemption_attempts
  add column client_attempt_id uuid unique,
  drop constraint code_redemption_attempts_outcome_check,
  add constraint code_redemption_attempts_outcome_check check (
    outcome in ('success', 'invalid_code', 'already_redeemed', 'rate_limited', 'not_ready', 'sync_expired')
  );

-- clients never write these tables directly
revoke insert, update, delete on table
  public.anomaly_flags,
  public.offline_sync_receipts,
  public.cache_pulls
from authenticated, anon;

-- ---------------------------------------------------------------------------
-- private.apply_redemption: the one place a code advances a ticket and money
-- settles. Both redeem_board_code (online) and sync_offline_redemption call
-- it; neither carries its own copy of the money rules.
-- Caller has already authenticated the conductor and located the board code.
-- ---------------------------------------------------------------------------
create or replace function private.apply_redemption(
  p_conductor_id uuid,
  p_owner_id uuid,
  p_commission_bps integer,
  p_actor uuid,
  p_ticket uuid,
  p_purpose text,
  p_vehicle uuid,
  p_extra_detail jsonb default '{}'::jsonb
)
returns table (outcome text, fare_cents integer, payment_method text, stage text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.ticket_event_type;
  v_ticket public.tickets%rowtype;
  v_required public.ticket_event_type;
  v_event public.ticket_event_type;
  v_stage text;
  v_settle boolean;
  v_fare bigint;
  v_commission bigint;
  v_owner_amount bigint;
  v_owner_wallet uuid;
  v_conductor_wallet uuid;
  v_escrow uuid;
  v_txn uuid;
begin
  -- serialise per ticket, then read status under the lock
  perform pg_advisory_xact_lock(hashtextextended(p_ticket::text, 7));

  select e.event_type into v_status
  from public.ticket_events e
  where e.ticket_id = p_ticket
  order by e.created_at desc, e.id desc
  limit 1;

  select * into v_ticket from public.tickets t where t.id = p_ticket;

  -- which prior status this code needs, what it advances to, when money moves
  if v_ticket.kind = 'fare' then
    v_required := 'issued';
    v_event := 'redeemed';
    v_stage := 'redeemed';
    v_settle := v_ticket.payment_method = 'wallet';
  elsif p_purpose = 'load' then
    v_required := 'issued';
    v_event := 'loaded';
    v_stage := 'loaded';
    v_settle := false;
  else
    v_required := 'loaded';
    v_event := 'collected';
    v_stage := 'collected';
    v_settle := v_ticket.payment_method = 'wallet';
  end if;

  if v_status is distinct from v_required then
    if v_ticket.kind = 'parcel' and p_purpose = 'collect' and v_status = 'issued' then
      return query select 'not_ready'::text, null::integer, null::text, null::text;
    else
      return query select 'already_redeemed'::text, null::integer, null::text, null::text;
    end if;
    return;
  end if;

  if v_settle then
    v_fare := v_ticket.fare_cents;
    v_commission := (v_fare * p_commission_bps) / 10000;
    v_owner_amount := v_fare - v_commission;

    select id into v_escrow
    from public.ledger_accounts
    where kind = 'platform_escrow' and profile_id is null;

    select a.id into v_owner_wallet
    from public.ledger_accounts a
    join public.owners o on o.profile_id = a.profile_id
    where o.id = p_owner_id and a.kind = 'owner_wallet';
    if v_owner_wallet is null then
      insert into public.ledger_accounts (kind, profile_id)
      select 'owner_wallet', o.profile_id from public.owners o where o.id = p_owner_id
      returning id into v_owner_wallet;
    end if;

    if v_commission > 0 then
      select id into v_conductor_wallet
      from public.ledger_accounts
      where profile_id = p_actor and kind = 'conductor_wallet';
      if v_conductor_wallet is null then
        insert into public.ledger_accounts (kind, profile_id)
        values ('conductor_wallet', p_actor)
        returning id into v_conductor_wallet;
      end if;
    end if;

    insert into public.ledger_transactions (kind, ticket_id, memo, created_by)
    values ('fare_settlement', p_ticket, 'fare settlement on redemption', p_actor)
    returning id into v_txn;

    insert into public.ledger_postings (transaction_id, account_id, amount_cents)
    values (v_txn, v_escrow, -v_fare), (v_txn, v_owner_wallet, v_owner_amount);
    if v_commission > 0 then
      insert into public.ledger_postings (transaction_id, account_id, amount_cents)
      values (v_txn, v_conductor_wallet, v_commission);
    end if;
  end if;

  insert into public.ticket_events (ticket_id, event_type, actor_profile_id, conductor_id, vehicle_id, detail)
  values (p_ticket, v_event, p_actor, p_conductor_id, p_vehicle,
          jsonb_build_object('payment_method', v_ticket.payment_method) || p_extra_detail);

  return query select 'success'::text, v_ticket.fare_cents, v_ticket.payment_method, v_stage;
end;
$$;

revoke execute on function private.apply_redemption(uuid, uuid, integer, uuid, uuid, text, uuid, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- redeem_board_code v4: same contract as v3, settlement delegated to
-- private.apply_redemption so online and offline share one money path.
-- ---------------------------------------------------------------------------
drop function public.redeem_board_code(uuid, public.route_direction, text, uuid);

create or replace function public.redeem_board_code(
  p_route uuid,
  p_direction public.route_direction,
  p_code text,
  p_vehicle uuid default null
)
returns table (outcome text, ticket_id uuid, fare_cents integer, payment_method text, stage text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_conductor public.conductors%rowtype;
  v_bc public.board_codes%rowtype;
  v_failures integer;
  v_res record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_conductor
  from public.conductors c
  where c.profile_id = v_uid and c.active;
  if not found then
    raise exception 'not an active conductor';
  end if;

  if p_vehicle is not null then
    perform 1 from public.vehicles v
    where v.id = p_vehicle and v.owner_id = v_conductor.owner_id;
    if not found then
      raise exception 'vehicle does not belong to your fleet';
    end if;
  end if;

  -- rate limit: at most 5 failed attempts in the last 10 minutes
  select count(*) into v_failures
  from public.code_redemption_attempts a
  where a.conductor_id = v_conductor.id
    and a.outcome <> 'success'
    and a.attempted_at > now() - interval '10 minutes';
  if v_failures >= 5 then
    insert into public.code_redemption_attempts (conductor_id, route_id, direction, code_entered, outcome)
    values (v_conductor.id, p_route, p_direction, p_code, 'rate_limited');
    return query select 'rate_limited'::text, null::uuid, null::integer, null::text, null::text;
    return;
  end if;

  select * into v_bc
  from public.board_codes b
  where b.route_id = p_route
    and b.direction = p_direction
    and b.code = p_code
    and b.valid_from <= now()
    and b.valid_until > now();
  if not found then
    -- expired and never-existed look identical on purpose (no oracle)
    insert into public.code_redemption_attempts (conductor_id, route_id, direction, code_entered, outcome)
    values (v_conductor.id, p_route, p_direction, p_code, 'invalid_code');
    return query select 'invalid_code'::text, null::uuid, null::integer, null::text, null::text;
    return;
  end if;

  select * into v_res
  from private.apply_redemption(
    v_conductor.id, v_conductor.owner_id, v_conductor.commission_rate_bps,
    v_uid, v_bc.ticket_id, v_bc.purpose, p_vehicle
  );

  insert into public.code_redemption_attempts (conductor_id, route_id, direction, code_entered, outcome, ticket_id)
  values (v_conductor.id, p_route, p_direction, p_code, v_res.outcome, v_bc.ticket_id);

  return query select v_res.outcome, v_bc.ticket_id, v_res.fare_cents, v_res.payment_method, v_res.stage;
end;
$$;

revoke execute on function public.redeem_board_code(uuid, public.route_direction, text, uuid) from public, anon;
grant execute on function public.redeem_board_code(uuid, public.route_direction, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- pull_offline_cache: the device's local copy of PENDING codes for one
-- route + direction. Hashes only. Rows disappear from the pull the moment
-- their required prior status is gone (redeemed/loaded elsewhere), so a
-- fresh cache never contains a spent code.
-- ---------------------------------------------------------------------------
create or replace function public.pull_offline_cache(
  p_route uuid,
  p_direction public.route_direction
)
returns table (
  ticket_id uuid,
  purpose text,
  code_salt text,
  code_hash text,
  fare_cents integer,
  payment_method text,
  kind text,
  valid_from timestamptz,
  valid_until timestamptz,
  server_time timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_conductor public.conductors%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_conductor
  from public.conductors c
  where c.profile_id = v_uid and c.active;
  if not found then
    raise exception 'not an active conductor';
  end if;

  -- pending rows + audit in one statement (the CTE is referenced twice so it
  -- is materialised once; no temp table, safe under connection pooling)
  return query
  with pending as (
    select
      b.ticket_id as t_id,
      b.purpose as t_purpose,
      encode(extensions.gen_random_bytes(16), 'hex') as t_salt,
      b.code as t_code,
      t.fare_cents as t_fare,
      t.payment_method as t_payment,
      t.kind::text as t_kind,
      b.valid_from as t_from,
      b.valid_until as t_until
    from public.board_codes b
    join public.tickets t on t.id = b.ticket_id
    join lateral (
      select e.event_type
      from public.ticket_events e
      where e.ticket_id = b.ticket_id
      order by e.created_at desc, e.id desc
      limit 1
    ) le on true
    where b.route_id = p_route
      and b.direction = p_direction
      and b.valid_until > now()
      and le.event_type = (case
        when t.kind = 'fare' then 'issued'
        when b.purpose = 'load' then 'issued'
        else 'loaded'
      end)::public.ticket_event_type
  ),
  audit as (
    insert into public.cache_pulls (conductor_id, route_id, direction, row_count)
    select v_conductor.id, p_route, p_direction, count(*) from pending
  )
  select
    p.t_id,
    p.t_purpose,
    p.t_salt,
    encode(extensions.digest(convert_to(p.t_salt || p.t_code, 'utf8'), 'sha256'), 'hex'),
    p.t_fare,
    p.t_payment,
    p.t_kind,
    p.t_from,
    p.t_until,
    now()
  from pending p;
end;
$$;

revoke execute on function public.pull_offline_cache(uuid, public.route_direction) from public, anon;
grant execute on function public.pull_offline_cache(uuid, public.route_direction) to authenticated;

-- ---------------------------------------------------------------------------
-- sync_offline_redemption: replay one queued offline redemption.
--   idempotent   same client_event_id returns the stored receipt, no rework
--   first wins   a code already advanced resolves 'already_redeemed' + flag
--   clock guard  claimed time validated against the code window; future
--                claims clamped + flagged; stale/late arrivals refused with
--                money untouched
--   rate limited failures count in the same 10 minute window as online;
--                rate_limited writes NO receipt so the device retries later
-- ---------------------------------------------------------------------------
create or replace function public.sync_offline_redemption(
  p_client_event_id uuid,
  p_route uuid,
  p_direction public.route_direction,
  p_code text,
  p_redeemed_at timestamptz,
  p_vehicle uuid default null
)
returns table (outcome text, ticket_id uuid, fare_cents integer, payment_method text, stage text, flagged boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- device clocks may run ahead; claims beyond this are clamped and flagged
  c_future_skew constant interval := interval '5 minutes';
  -- a queue must land within this window of the code expiring, else refused
  c_sync_grace constant interval := interval '72 hours';
  -- anything claiming to be older than this is a stale replay, refused
  c_stale_after constant interval := interval '7 days';

  v_uid uuid := (select auth.uid());
  v_conductor public.conductors%rowtype;
  v_receipt public.offline_sync_receipts%rowtype;
  v_claimed timestamptz;
  v_skewed boolean := false;
  v_failures integer;
  v_bc public.board_codes%rowtype;
  v_res record;
  v_first_conductor uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_client_event_id is null or p_redeemed_at is null then
    raise exception 'client event id and redeemed_at are required';
  end if;

  select * into v_conductor
  from public.conductors c
  where c.profile_id = v_uid and c.active;
  if not found then
    raise exception 'not an active conductor';
  end if;

  if p_vehicle is not null then
    perform 1 from public.vehicles v
    where v.id = p_vehicle and v.owner_id = v_conductor.owner_id;
    if not found then
      raise exception 'vehicle does not belong to your fleet';
    end if;
  end if;

  -- idempotent replay: return what already happened, touch nothing
  select * into v_receipt
  from public.offline_sync_receipts r
  where r.client_event_id = p_client_event_id;
  if found then
    return query select
      v_receipt.outcome,
      v_receipt.ticket_id,
      (v_receipt.detail ->> 'fare_cents')::integer,
      v_receipt.detail ->> 'payment_method',
      v_receipt.detail ->> 'stage',
      coalesce((v_receipt.detail ->> 'flagged')::boolean, false);
    return;
  end if;

  -- clock guard: the future is testimony we do not accept
  v_claimed := p_redeemed_at;
  if v_claimed > now() + c_future_skew then
    insert into public.anomaly_flags (kind, severity, route_id, owner_id, detail)
    values ('clock_skew', 'info', p_route, v_conductor.owner_id,
            jsonb_build_object('claimed_at', p_redeemed_at, 'server_time', now(),
                               'client_event_id', p_client_event_id));
    v_claimed := now();
    v_skewed := true;
  end if;

  if v_claimed < now() - c_stale_after then
    insert into public.anomaly_flags (kind, severity, route_id, owner_id, detail)
    values ('stale_offline_event', 'warning', p_route, v_conductor.owner_id,
            jsonb_build_object('claimed_at', p_redeemed_at, 'server_time', now(),
                               'client_event_id', p_client_event_id));
    insert into public.code_redemption_attempts
      (conductor_id, route_id, direction, code_entered, outcome, client_attempt_id)
    values (v_conductor.id, p_route, p_direction, p_code, 'sync_expired', p_client_event_id)
    on conflict (client_attempt_id) do nothing;
    insert into public.offline_sync_receipts (client_event_id, conductor_id, event_kind, outcome, detail)
    values (p_client_event_id, v_conductor.id, 'redeem', 'sync_expired',
            jsonb_build_object('flagged', true));
    return query select 'sync_expired'::text, null::uuid, null::integer, null::text, null::text, true;
    return;
  end if;

  -- rate limit: shared window with online redemption. No receipt on
  -- rate_limited: the device keeps the event queued and retries after the
  -- cooldown instead of freezing it forever.
  select count(*) into v_failures
  from public.code_redemption_attempts a
  where a.conductor_id = v_conductor.id
    and a.outcome <> 'success'
    and a.attempted_at > now() - interval '10 minutes';
  if v_failures >= 5 then
    insert into public.code_redemption_attempts (conductor_id, route_id, direction, code_entered, outcome)
    values (v_conductor.id, p_route, p_direction, p_code, 'rate_limited');
    return query select 'rate_limited'::text, null::uuid, null::integer, null::text, null::text, false;
    return;
  end if;

  -- the code must have been valid at the claimed moment
  select * into v_bc
  from public.board_codes b
  where b.route_id = p_route
    and b.direction = p_direction
    and b.code = p_code
    and b.valid_from <= v_claimed
    and b.valid_until > v_claimed;
  if not found then
    insert into public.code_redemption_attempts
      (conductor_id, route_id, direction, code_entered, outcome, client_attempt_id)
    values (v_conductor.id, p_route, p_direction, p_code, 'invalid_code', p_client_event_id)
    on conflict (client_attempt_id) do nothing;
    insert into public.offline_sync_receipts (client_event_id, conductor_id, event_kind, outcome, detail)
    values (p_client_event_id, v_conductor.id, 'redeem', 'invalid_code',
            jsonb_build_object('flagged', v_skewed));
    return query select 'invalid_code'::text, null::uuid, null::integer, null::text, null::text, v_skewed;
    return;
  end if;

  -- the sync itself must arrive within the grace window; a device that
  -- surfaces months later does not move money on its own say-so
  if now() > v_bc.valid_until + c_sync_grace then
    insert into public.anomaly_flags (kind, severity, ticket_id, route_id, owner_id, detail)
    values ('late_sync', 'warning', v_bc.ticket_id, p_route, v_conductor.owner_id,
            jsonb_build_object('claimed_at', p_redeemed_at, 'server_time', now(),
                               'valid_until', v_bc.valid_until,
                               'client_event_id', p_client_event_id));
    insert into public.code_redemption_attempts
      (conductor_id, route_id, direction, code_entered, outcome, ticket_id, client_attempt_id)
    values (v_conductor.id, p_route, p_direction, p_code, 'sync_expired', v_bc.ticket_id, p_client_event_id)
    on conflict (client_attempt_id) do nothing;
    insert into public.offline_sync_receipts (client_event_id, conductor_id, event_kind, outcome, ticket_id, detail)
    values (p_client_event_id, v_conductor.id, 'redeem', 'sync_expired', v_bc.ticket_id,
            jsonb_build_object('flagged', true));
    return query select 'sync_expired'::text, v_bc.ticket_id, null::integer, null::text, null::text, true;
    return;
  end if;

  select * into v_res
  from private.apply_redemption(
    v_conductor.id, v_conductor.owner_id, v_conductor.commission_rate_bps,
    v_uid, v_bc.ticket_id, v_bc.purpose, p_vehicle,
    jsonb_build_object(
      'offline', true,
      'claimed_at', p_redeemed_at,
      'synced_at', now(),
      'client_event_id', p_client_event_id
    )
  );

  insert into public.code_redemption_attempts
    (conductor_id, route_id, direction, code_entered, outcome, ticket_id, client_attempt_id)
  values (v_conductor.id, p_route, p_direction, p_code, v_res.outcome, v_bc.ticket_id, p_client_event_id)
  on conflict (client_attempt_id) do nothing;

  -- first sync won earlier: this one is the conflict the spec names.
  -- Flag the pattern for the owner; ids in detail, accusation nowhere.
  if v_res.outcome = 'already_redeemed' then
    select e.conductor_id into v_first_conductor
    from public.ticket_events e
    where e.ticket_id = v_bc.ticket_id
      and e.event_type in ('redeemed', 'loaded', 'collected')
    order by e.created_at asc, e.id asc
    limit 1;

    insert into public.anomaly_flags (kind, severity, ticket_id, route_id, owner_id, detail)
    values ('offline_duplicate_redemption', 'warning', v_bc.ticket_id, p_route, v_conductor.owner_id,
            jsonb_build_object(
              'first_conductor_id', v_first_conductor,
              'refused_conductor_id', v_conductor.id,
              'claimed_at', p_redeemed_at,
              'synced_at', now(),
              'client_event_id', p_client_event_id
            ));
  end if;

  insert into public.offline_sync_receipts (client_event_id, conductor_id, event_kind, outcome, ticket_id, detail)
  values (p_client_event_id, v_conductor.id, 'redeem', v_res.outcome, v_bc.ticket_id,
          jsonb_build_object(
            'fare_cents', v_res.fare_cents,
            'payment_method', v_res.payment_method,
            'stage', v_res.stage,
            'flagged', v_res.outcome = 'already_redeemed' or v_skewed
          ));

  return query select
    v_res.outcome, v_bc.ticket_id, v_res.fare_cents, v_res.payment_method, v_res.stage,
    (v_res.outcome = 'already_redeemed' or v_skewed);
end;
$$;

revoke execute on function public.sync_offline_redemption(uuid, uuid, public.route_direction, text, timestamptz, uuid) from public, anon;
grant execute on function public.sync_offline_redemption(uuid, uuid, public.route_direction, text, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- sync_offline_change_credit: replay a change-to-credit recorded offline.
-- Wraps record_change_credit (all its rules hold: cash only, once per
-- ticket, redeemed by this conductor, real notes) behind the same receipt
-- idempotency. A duplicate from a second device resolves as 'rejected' and
-- flags the pattern; the rider is never credited twice.
-- ---------------------------------------------------------------------------
create or replace function public.sync_offline_change_credit(
  p_client_event_id uuid,
  p_ticket uuid,
  p_note_cents integer,
  p_covered_fares integer,
  p_recorded_at timestamptz
)
returns table (outcome text, change_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_conductor public.conductors%rowtype;
  v_receipt public.offline_sync_receipts%rowtype;
  v_change integer;
  v_reason text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_client_event_id is null then
    raise exception 'client event id is required';
  end if;

  select * into v_conductor
  from public.conductors c
  where c.profile_id = v_uid and c.active;
  if not found then
    raise exception 'not an active conductor';
  end if;

  select * into v_receipt
  from public.offline_sync_receipts r
  where r.client_event_id = p_client_event_id;
  if found then
    return query select
      v_receipt.outcome,
      (v_receipt.detail ->> 'change_cents')::integer;
    return;
  end if;

  begin
    select rcc.change_cents into v_change
    from public.record_change_credit(p_ticket, p_note_cents, p_covered_fares) rcc;
  exception when others then
    v_reason := sqlerrm;
    if v_reason like '%already credited%' then
      insert into public.anomaly_flags (kind, severity, ticket_id, owner_id, detail)
      values ('offline_duplicate_change', 'warning', p_ticket, v_conductor.owner_id,
              jsonb_build_object(
                'refused_conductor_id', v_conductor.id,
                'recorded_at', p_recorded_at,
                'synced_at', now(),
                'client_event_id', p_client_event_id
              ));
    end if;
    insert into public.offline_sync_receipts (client_event_id, conductor_id, event_kind, outcome, ticket_id, detail)
    values (p_client_event_id, v_conductor.id, 'change_credit', 'rejected', p_ticket,
            jsonb_build_object('reason', v_reason));
    return query select 'rejected'::text, null::integer;
    return;
  end;

  insert into public.offline_sync_receipts (client_event_id, conductor_id, event_kind, outcome, ticket_id, detail)
  values (p_client_event_id, v_conductor.id, 'change_credit', 'success', p_ticket,
          jsonb_build_object('change_cents', v_change, 'recorded_at', p_recorded_at));

  return query select 'success'::text, v_change;
end;
$$;

revoke execute on function public.sync_offline_change_credit(uuid, uuid, integer, integer, timestamptz) from public, anon;
grant execute on function public.sync_offline_change_credit(uuid, uuid, integer, integer, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- log_offline_attempts: failed keypad entries made offline sync here so the
-- server side attempt log stays complete and the rate limiter sees them.
-- Dedupe on client_attempt_id; success is never accepted from a log (only
-- the server grants success).
-- ---------------------------------------------------------------------------
create or replace function public.log_offline_attempts(p_attempts jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_conductor public.conductors%rowtype;
  v_item jsonb;
  v_outcome text;
  v_attempted timestamptz;
  v_inserted integer := 0;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_conductor
  from public.conductors c
  where c.profile_id = v_uid and c.active;
  if not found then
    raise exception 'not an active conductor';
  end if;

  if p_attempts is null or jsonb_typeof(p_attempts) <> 'array' then
    raise exception 'attempts must be a json array';
  end if;
  select jsonb_array_length(p_attempts) into v_count;
  if v_count > 500 then
    raise exception 'too many attempts in one call';
  end if;

  for v_item in select * from jsonb_array_elements(p_attempts) loop
    v_outcome := v_item ->> 'outcome';
    if v_outcome not in ('invalid_code', 'already_redeemed', 'rate_limited') then
      raise exception 'outcome % is not a loggable offline outcome', v_outcome;
    end if;
    if (v_item ->> 'code_entered') !~ '^[0-9]{1,8}$' then
      raise exception 'code_entered must be 1-8 digits';
    end if;

    -- claimed times are clamped into [7 days ago, now]; missing means now
    v_attempted := least(
      greatest(
        coalesce((v_item ->> 'attempted_at')::timestamptz, now()),
        now() - interval '7 days'
      ),
      now()
    );

    insert into public.code_redemption_attempts
      (conductor_id, route_id, direction, code_entered, outcome, attempted_at, client_attempt_id)
    values (
      v_conductor.id,
      nullif(v_item ->> 'route_id', '')::uuid,
      nullif(v_item ->> 'direction', '')::public.route_direction,
      v_item ->> 'code_entered',
      v_outcome,
      v_attempted,
      (v_item ->> 'client_attempt_id')::uuid
    )
    on conflict (client_attempt_id) do nothing;
    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$$;

revoke execute on function public.log_offline_attempts(jsonb) from public, anon;
grant execute on function public.log_offline_attempts(jsonb) to authenticated;
