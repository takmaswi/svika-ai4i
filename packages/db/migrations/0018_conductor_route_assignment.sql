-- 0018 conductor route assignment (P2 security polish)
--
-- Finding: pull_offline_cache (0014) let ANY active conductor pull the
-- pending code cache for ANY route + direction, and the redeem/sync RPCs
-- accepted any route the same way. A conductor account from one fleet could
-- harvest the hashed code cache of every corridor in the city.
--
-- Fix: a conductor works a route only when an active route assignment says
-- so. The shape is deliberately simple and honest: one row means "this
-- conductor is cleared to work this route" (their shift route). A conductor
-- may hold more than one active assignment (a hwindi who swaps corridors in
-- a day; the demo conductor works two corridors across the e2e suites), so
-- exclusivity is NOT enforced and nothing here pretends to be a roster.
--
-- Enforcement, all server side in the security definer RPCs:
--   pull_offline_cache        refused: audit row in cache_pulls
--                             (outcome 'refused_unassigned') + a coarse
--                             'route_not_assigned' marker row to the caller
--   redeem_board_code         refused: 'route_not_assigned' outcome, attempt
--                             logged in code_redemption_attempts
--   sync_offline_redemption   refused: 'route_not_assigned' outcome, attempt
--                             logged, NO receipt written (like rate_limited,
--                             the event may replay once assignment exists)
--
-- Deliberately NOT gated:
--   sync_offline_change_credit  takes a ticket, not a route; the inner
--                               record_change_credit already requires the
--                               ticket to have been cleared by THIS
--                               conductor, which the redeem gate now scopes
--   log_offline_attempts        an audit intake of FAILED keypad entries;
--                               refusing it would erase evidence, and it can
--                               never move money or grant success
--
-- Rejection reasons stay coarse on purpose: the caller learns "not your
-- route" and nothing about which routes exist, are assigned, or to whom.
-- Assignment writes are service role only (seed) for now; an owner facing
-- roster surface is a product decision that has not been made.

create table public.conductor_route_assignments (
  id uuid primary key default gen_random_uuid(),
  conductor_id uuid not null references public.conductors (id) on delete restrict,
  route_id uuid not null references public.routes (id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (conductor_id, route_id)
);

create index conductor_route_assignments_conductor_idx
  on public.conductor_route_assignments (conductor_id) where active;

alter table public.conductor_route_assignments enable row level security;

-- the conductor sees their own assignments; the owner sees the fleet's
create policy "route assignments select own or fleet"
  on public.conductor_route_assignments for select
  to authenticated
  using (
    conductor_id in (
      select id from public.conductors
      where profile_id = (select auth.uid())
         or owner_id = (select private.current_owner_id())
    )
  );

-- clients never write assignments; the seed (service role) manages them
revoke insert, update, delete on table public.conductor_route_assignments
from authenticated, anon;

-- ---------------------------------------------------------------------------
-- private.route_assigned: the one check every gated RPC calls.
-- ---------------------------------------------------------------------------
create or replace function private.route_assigned(p_conductor uuid, p_route uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.conductor_route_assignments a
    where a.conductor_id = p_conductor
      and a.route_id = p_route
      and a.active
  );
$$;

revoke execute on function private.route_assigned(uuid, uuid) from public, anon, authenticated;

-- refused pulls are audit logged next to the successful ones
alter table public.cache_pulls
  add column outcome text not null default 'ok'
  check (outcome in ('ok', 'refused_unassigned'));

-- the attempt log learns the new coarse outcome
alter table public.code_redemption_attempts
  drop constraint code_redemption_attempts_outcome_check,
  add constraint code_redemption_attempts_outcome_check check (
    outcome in ('success', 'invalid_code', 'already_redeemed', 'rate_limited',
                'not_ready', 'sync_expired', 'route_not_assigned')
  );

-- ---------------------------------------------------------------------------
-- pull_offline_cache v2: assignment gated. The returned rows carry an
-- outcome column: 'ok' rows are the cache; a single 'route_not_assigned'
-- row (all data fields null) is the coarse refusal. The refusal cannot
-- raise, because the audit insert must survive the call.
-- ---------------------------------------------------------------------------
drop function public.pull_offline_cache(uuid, public.route_direction);

create or replace function public.pull_offline_cache(
  p_route uuid,
  p_direction public.route_direction
)
returns table (
  outcome text,
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

  if not private.route_assigned(v_conductor.id, p_route) then
    insert into public.cache_pulls (conductor_id, route_id, direction, row_count, outcome)
    values (v_conductor.id, p_route, p_direction, 0, 'refused_unassigned');
    return query select
      'route_not_assigned'::text,
      null::uuid, null::text, null::text, null::text, null::integer,
      null::text, null::text, null::timestamptz, null::timestamptz,
      now();
    return;
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
    'ok'::text,
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
-- redeem_board_code v5: assignment gated after the rate limiter (so probing
-- unassigned routes still burns the same failure budget), before the code
-- lookup (so an unassigned conductor learns nothing about codes).
-- ---------------------------------------------------------------------------
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

  -- assignment gate: not your route, no code oracle
  if not private.route_assigned(v_conductor.id, p_route) then
    insert into public.code_redemption_attempts (conductor_id, route_id, direction, code_entered, outcome)
    values (v_conductor.id, p_route, p_direction, p_code, 'route_not_assigned');
    return query select 'route_not_assigned'::text, null::uuid, null::integer, null::text, null::text;
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

-- ---------------------------------------------------------------------------
-- sync_offline_redemption v3 (v2 was 0016): assignment gated in the same
-- position as online redeem. The refusal writes the attempt (deduped on the
-- client event id) but NO receipt: if the assignment arrives later the
-- queued event may still replay and settle; until then money never moves.
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

  -- idempotent replay: return what already happened, touch nothing.
  -- Only the conductor who synced the event may read its receipt.
  select * into v_receipt
  from public.offline_sync_receipts r
  where r.client_event_id = p_client_event_id;
  if found then
    if v_receipt.conductor_id <> v_conductor.id then
      raise exception 'sync event belongs to another conductor';
    end if;
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

  -- assignment gate: same position as online redeem, attempt logged, no
  -- receipt (the event may legitimately replay once an assignment exists)
  if not private.route_assigned(v_conductor.id, p_route) then
    insert into public.code_redemption_attempts
      (conductor_id, route_id, direction, code_entered, outcome, client_attempt_id)
    values (v_conductor.id, p_route, p_direction, p_code, 'route_not_assigned', p_client_event_id)
    on conflict (client_attempt_id) do nothing;
    return query select 'route_not_assigned'::text, null::uuid, null::integer, null::text, null::text, false;
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

-- grants: authenticated only, anon revoked (restated for the reader; the
-- drop/create of pull_offline_cache resets its ACL, the others keep theirs)
revoke execute on function public.redeem_board_code(uuid, public.route_direction, text, uuid) from public, anon;
grant execute on function public.redeem_board_code(uuid, public.route_direction, text, uuid) to authenticated;
revoke execute on function public.sync_offline_redemption(uuid, uuid, public.route_direction, text, timestamptz, uuid) from public, anon;
grant execute on function public.sync_offline_redemption(uuid, uuid, public.route_direction, text, timestamptz, uuid) to authenticated;
