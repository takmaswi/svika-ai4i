-- 0012 parcels: a ticket kind with LOAD and COLLECT codes
-- A parcel is an event sourced ticket (kind 'parcel') carrying two scoped
-- 4 digit codes: the sender's LOAD code proves the parcel got on the kombi,
-- the receiver's COLLECT code releases it at the other end. Wallet paid
-- parcels settle to the owner at COLLECT (delivery complete); cash parcels
-- take the note at LOAD, where the change to credit flow applies as usual.
--
-- board_codes gains a purpose ('board' | 'load' | 'collect'); uniqueness
-- becomes one code per ticket per purpose. redeem_board_code becomes stage
-- aware and reports the stage it advanced the ticket to.

alter type public.ticket_event_type add value if not exists 'loaded';
alter type public.ticket_event_type add value if not exists 'collected';

alter table public.board_codes
  drop constraint board_codes_ticket_id_key,
  add column purpose text not null default 'board'
    check (purpose in ('board', 'load', 'collect')),
  add constraint board_codes_ticket_purpose_key unique (ticket_id, purpose);

-- attempts can now also be refused because the parcel is not loaded yet
alter table public.code_redemption_attempts
  drop constraint code_redemption_attempts_outcome_check,
  add constraint code_redemption_attempts_outcome_check check (
    outcome in ('success', 'invalid_code', 'already_redeemed', 'rate_limited', 'not_ready')
  );

-- ---------------------------------------------------------------------------
-- purchase_parcel: like purchase_ticket, but two codes and a day window
-- ---------------------------------------------------------------------------
create or replace function public.purchase_parcel(
  p_route uuid,
  p_direction public.route_direction,
  p_from_stop uuid,
  p_to_stop uuid,
  p_payment text default 'wallet',
  p_valid_minutes integer default 1440
)
returns table (ticket_id uuid, load_code text, collect_code text, fare_cents integer, valid_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider uuid := (select auth.uid());
  v_fare integer;
  v_wallet uuid;
  v_escrow uuid;
  v_balance bigint;
  v_ticket uuid;
  v_txn uuid;
  v_valid_until timestamptz;
  v_load text;
  v_collect text;
begin
  if v_rider is null then
    raise exception 'not authenticated';
  end if;
  if p_valid_minutes < 60 or p_valid_minutes > 4320 then
    raise exception 'validity window out of range';
  end if;
  if p_payment not in ('wallet', 'cash') then
    raise exception 'unknown payment method';
  end if;
  if p_from_stop is null or p_to_stop is null or p_from_stop = p_to_stop then
    raise exception 'parcel needs two different stops';
  end if;

  perform 1 from public.routes r where r.id = p_route and r.active;
  if not found then
    raise exception 'unknown or inactive route';
  end if;
  perform 1 from public.route_stops
  where route_id = p_route and stop_id = p_from_stop and direction = p_direction;
  if not found then
    raise exception 'load stop is not on this route direction';
  end if;
  perform 1 from public.route_stops
  where route_id = p_route and stop_id = p_to_stop and direction = p_direction;
  if not found then
    raise exception 'collect stop is not on this route direction';
  end if;

  v_fare := public.assert_plausible_fare(coalesce(
    public.segment_fare_cents(p_route, p_from_stop, p_to_stop),
    public.current_fare_cents(p_route)
  ));

  if p_payment = 'wallet' then
    select id into v_wallet
    from public.ledger_accounts
    where profile_id = v_rider and kind = 'rider_wallet';
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
    if v_balance < v_fare then
      raise exception 'insufficient wallet balance';
    end if;
  end if;

  insert into public.tickets (rider_id, route_id, direction, fare_cents, kind, from_stop_id, to_stop_id, payment_method)
  values (v_rider, p_route, p_direction, v_fare, 'parcel', p_from_stop, p_to_stop, p_payment)
  returning id into v_ticket;

  insert into public.ticket_events (ticket_id, event_type, actor_profile_id, detail)
  values (v_ticket, 'issued', v_rider, jsonb_build_object('payment_method', p_payment, 'kind', 'parcel'));

  if p_payment = 'wallet' then
    insert into public.ledger_transactions (kind, ticket_id, memo, created_by)
    values ('ticket_purchase', v_ticket, 'parcel booking', v_rider)
    returning id into v_txn;

    insert into public.ledger_postings (transaction_id, account_id, amount_cents)
    values
      (v_txn, v_wallet, -v_fare),
      (v_txn, v_escrow, v_fare);
  end if;

  v_valid_until := now() + make_interval(mins => p_valid_minutes);
  v_load := private.allocate_board_code(v_ticket, p_route, p_direction, v_valid_until, 'load');
  v_collect := private.allocate_board_code(v_ticket, p_route, p_direction, v_valid_until, 'collect');

  return query select v_ticket, v_load, v_collect, v_fare, v_valid_until;
end;
$$;

-- shared code allocation, out of REST reach in the private schema
create or replace function private.allocate_board_code(
  p_ticket uuid,
  p_route uuid,
  p_direction public.route_direction,
  p_valid_until timestamptz,
  p_purpose text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_bytes bytea;
  v_tries integer := 0;
begin
  loop
    v_bytes := extensions.gen_random_bytes(2);
    v_code := lpad((((get_byte(v_bytes, 0) << 8) | get_byte(v_bytes, 1)) % 10000)::text, 4, '0');
    begin
      insert into public.board_codes (ticket_id, route_id, direction, code, valid_until, purpose)
      values (p_ticket, p_route, p_direction, v_code, p_valid_until, p_purpose);
      return v_code;
    exception when exclusion_violation then
      v_tries := v_tries + 1;
      if v_tries >= 25 then
        raise exception 'could not allocate a code, try again';
      end if;
    end;
  end loop;
end;
$$;

revoke execute on function private.allocate_board_code(uuid, uuid, public.route_direction, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.purchase_parcel(uuid, public.route_direction, uuid, uuid, text, integer) from public, anon;
grant execute on function public.purchase_parcel(uuid, public.route_direction, uuid, uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- redeem v3: stage aware (board / load / collect)
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

  -- serialise per ticket, then re-check status under the lock
  perform pg_advisory_xact_lock(hashtextextended(v_bc.ticket_id::text, 7));

  select e.event_type into v_status
  from public.ticket_events e
  where e.ticket_id = v_bc.ticket_id
  order by e.created_at desc, e.id desc
  limit 1;

  select * into v_ticket from public.tickets t where t.id = v_bc.ticket_id;

  -- which prior status this code needs, what it advances to, when money moves
  if v_ticket.kind = 'fare' then
    v_required := 'issued';
    v_event := 'redeemed';
    v_stage := 'redeemed';
    v_settle := v_ticket.payment_method = 'wallet';
  elsif v_bc.purpose = 'load' then
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
    if v_ticket.kind = 'parcel' and v_bc.purpose = 'collect' and v_status = 'issued' then
      -- collect before load: the parcel never got on the kombi
      insert into public.code_redemption_attempts (conductor_id, route_id, direction, code_entered, outcome, ticket_id)
      values (v_conductor.id, p_route, p_direction, p_code, 'not_ready', v_bc.ticket_id);
      return query select 'not_ready'::text, v_bc.ticket_id, null::integer, null::text, null::text;
    else
      insert into public.code_redemption_attempts (conductor_id, route_id, direction, code_entered, outcome, ticket_id)
      values (v_conductor.id, p_route, p_direction, p_code, 'already_redeemed', v_bc.ticket_id);
      return query select 'already_redeemed'::text, v_bc.ticket_id, null::integer, null::text, null::text;
    end if;
    return;
  end if;

  if v_settle then
    v_fare := v_ticket.fare_cents;
    v_commission := (v_fare * v_conductor.commission_rate_bps) / 10000;
    v_owner_amount := v_fare - v_commission;

    select id into v_escrow
    from public.ledger_accounts
    where kind = 'platform_escrow' and profile_id is null;

    select a.id into v_owner_wallet
    from public.ledger_accounts a
    join public.owners o on o.profile_id = a.profile_id
    where o.id = v_conductor.owner_id and a.kind = 'owner_wallet';
    if v_owner_wallet is null then
      insert into public.ledger_accounts (kind, profile_id)
      select 'owner_wallet', o.profile_id from public.owners o where o.id = v_conductor.owner_id
      returning id into v_owner_wallet;
    end if;

    if v_commission > 0 then
      select id into v_conductor_wallet
      from public.ledger_accounts
      where profile_id = v_uid and kind = 'conductor_wallet';
      if v_conductor_wallet is null then
        insert into public.ledger_accounts (kind, profile_id)
        values ('conductor_wallet', v_uid)
        returning id into v_conductor_wallet;
      end if;
    end if;

    insert into public.ledger_transactions (kind, ticket_id, memo, created_by)
    values ('fare_settlement', v_bc.ticket_id, 'fare settlement on ' || v_stage, v_uid)
    returning id into v_txn;

    insert into public.ledger_postings (transaction_id, account_id, amount_cents)
    values (v_txn, v_escrow, -v_fare), (v_txn, v_owner_wallet, v_owner_amount);
    if v_commission > 0 then
      insert into public.ledger_postings (transaction_id, account_id, amount_cents)
      values (v_txn, v_conductor_wallet, v_commission);
    end if;
  end if;

  insert into public.ticket_events (ticket_id, event_type, actor_profile_id, conductor_id, vehicle_id, detail)
  values (v_bc.ticket_id, v_event, v_uid, v_conductor.id, p_vehicle,
          jsonb_build_object('payment_method', v_ticket.payment_method, 'purpose', v_bc.purpose));

  insert into public.code_redemption_attempts (conductor_id, route_id, direction, code_entered, outcome, ticket_id)
  values (v_conductor.id, p_route, p_direction, p_code, 'success', v_bc.ticket_id);

  return query select 'success'::text, v_bc.ticket_id, v_ticket.fare_cents, v_ticket.payment_method, v_stage;
end;
$$;

revoke execute on function public.redeem_board_code(uuid, public.route_direction, text, uuid) from public, anon;
grant execute on function public.redeem_board_code(uuid, public.route_direction, text, uuid) to authenticated;

-- change to credit now also applies to cash parcels at LOAD
create or replace function public.record_change_credit(
  p_ticket uuid,
  p_note_cents integer,
  p_covered_fares integer default 1
)
returns table (change_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_conductor public.conductors%rowtype;
  v_ticket public.tickets%rowtype;
  v_covered bigint;
  v_change bigint;
  v_wallet uuid;
  v_cash uuid;
  v_txn uuid;
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

  if p_note_cents not in (100, 200, 500, 1000, 2000) then
    raise exception 'not a USD note denomination';
  end if;
  if p_covered_fares < 1 or p_covered_fares > 20 then
    raise exception 'fares covered out of range';
  end if;

  select * into v_ticket from public.tickets t where t.id = p_ticket;
  if not found then
    raise exception 'unknown ticket';
  end if;
  if v_ticket.payment_method <> 'cash' then
    raise exception 'change applies to cash fares only';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_ticket::text, 7));

  -- only the conductor who took the note (cleared or loaded) may credit it
  perform 1 from public.ticket_events e
  where e.ticket_id = p_ticket
    and e.event_type in ('redeemed', 'loaded')
    and e.conductor_id = v_conductor.id;
  if not found then
    raise exception 'ticket was not cleared by you';
  end if;

  perform 1 from public.ledger_transactions
  where ticket_id = p_ticket and kind = 'change_credit';
  if found then
    raise exception 'change already credited for this ticket';
  end if;

  v_covered := v_ticket.fare_cents::bigint * p_covered_fares;
  v_change := p_note_cents - v_covered;
  if v_change <= 0 then
    raise exception 'no change to credit';
  end if;

  select id into v_wallet
  from public.ledger_accounts
  where profile_id = v_ticket.rider_id and kind = 'rider_wallet';
  if v_wallet is null then
    raise exception 'rider has no wallet';
  end if;

  select id into v_cash
  from public.ledger_accounts
  where kind = 'external_cash' and profile_id is null;

  insert into public.ledger_transactions (kind, ticket_id, memo, created_by)
  values (
    'change_credit',
    p_ticket,
    format('change on a %s note covering %s fare(s)', p_note_cents, p_covered_fares),
    v_uid
  )
  returning id into v_txn;

  insert into public.ledger_postings (transaction_id, account_id, amount_cents)
  values
    (v_txn, v_wallet, v_change),
    (v_txn, v_cash, -v_change);

  return query select v_change::integer;
end;
$$;

revoke execute on function public.record_change_credit(uuid, integer, integer) from public, anon;
grant execute on function public.record_change_credit(uuid, integer, integer) to authenticated;
