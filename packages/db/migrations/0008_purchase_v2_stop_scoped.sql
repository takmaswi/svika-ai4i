-- 0008 purchase v2: stop scoped fares and cash reservation
-- Tickets now carry the journey (board and alight stops) and how the rider
-- pays. Wallet tickets debit the rider wallet into platform escrow at
-- purchase; cash reservations move no ledger money (the note changes hands
-- on the kombi; the change to credit flow handles what comes back). The
-- fare comes from the dated fare segment for the pair, falling back to the
-- route's end to end fare (never undercharge, never invent a tier), and is
-- refused outside the plausibility band ($0.50 to $3.00) as a data error.
-- redeem_board_code settles escrow only for wallet tickets.

create type public.ticket_kind as enum ('fare', 'parcel');

alter table public.tickets
  add column kind public.ticket_kind not null default 'fare',
  add column from_stop_id uuid references public.stops (id) on delete restrict,
  add column to_stop_id uuid references public.stops (id) on delete restrict,
  add column payment_method text not null default 'wallet'
    check (payment_method in ('wallet', 'cash'));

-- fare plausibility band, shared with @svika/shared fares.ts
create or replace function public.assert_plausible_fare(p_fare integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_fare is null or p_fare < 50 or p_fare > 300 then
    raise exception 'fare % is outside the plausible band', p_fare;
  end if;
  return p_fare;
end;
$$;

revoke execute on function public.assert_plausible_fare(integer) from public, anon, authenticated;
revoke execute on function public.segment_fare_cents(uuid, uuid, uuid) from public, anon;

drop function public.purchase_ticket(uuid, public.route_direction, integer);

create or replace function public.purchase_ticket(
  p_route uuid,
  p_direction public.route_direction,
  p_valid_minutes integer default 120,
  p_from_stop uuid default null,
  p_to_stop uuid default null,
  p_payment text default 'wallet'
)
returns table (ticket_id uuid, board_code text, fare_cents integer, valid_until timestamptz)
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
  v_code text;
  v_bytes bytea;
  v_valid_until timestamptz;
  v_tries integer := 0;
begin
  if v_rider is null then
    raise exception 'not authenticated';
  end if;
  if p_valid_minutes < 15 or p_valid_minutes > 1440 then
    raise exception 'validity window out of range';
  end if;
  if p_payment not in ('wallet', 'cash') then
    raise exception 'unknown payment method';
  end if;
  if (p_from_stop is null) <> (p_to_stop is null) then
    raise exception 'provide both stops or neither';
  end if;
  if p_from_stop is not null and p_from_stop = p_to_stop then
    raise exception 'origin and destination are the same stop';
  end if;

  perform 1 from public.routes r where r.id = p_route and r.active;
  if not found then
    raise exception 'unknown or inactive route';
  end if;

  if p_from_stop is not null then
    perform 1 from public.route_stops
    where route_id = p_route and stop_id = p_from_stop and direction = p_direction;
    if not found then
      raise exception 'board stop is not on this route direction';
    end if;
    perform 1 from public.route_stops
    where route_id = p_route and stop_id = p_to_stop and direction = p_direction;
    if not found then
      raise exception 'alight stop is not on this route direction';
    end if;
    v_fare := coalesce(
      public.segment_fare_cents(p_route, p_from_stop, p_to_stop),
      public.current_fare_cents(p_route)
    );
  else
    v_fare := public.current_fare_cents(p_route);
  end if;
  v_fare := public.assert_plausible_fare(v_fare);

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

    -- serialise balance check and debit per wallet
    perform pg_advisory_xact_lock(hashtextextended(v_wallet::text, 42));

    select coalesce(sum(amount_cents), 0) into v_balance
    from public.ledger_postings
    where account_id = v_wallet;
    if v_balance < v_fare then
      raise exception 'insufficient wallet balance';
    end if;
  end if;

  insert into public.tickets (rider_id, route_id, direction, fare_cents, from_stop_id, to_stop_id, payment_method)
  values (v_rider, p_route, p_direction, v_fare, p_from_stop, p_to_stop, p_payment)
  returning id into v_ticket;

  insert into public.ticket_events (ticket_id, event_type, actor_profile_id, detail)
  values (v_ticket, 'issued', v_rider, jsonb_build_object('payment_method', p_payment));

  if p_payment = 'wallet' then
    insert into public.ledger_transactions (kind, ticket_id, memo, created_by)
    values ('ticket_purchase', v_ticket, 'ticket purchase', v_rider)
    returning id into v_txn;

    insert into public.ledger_postings (transaction_id, account_id, amount_cents)
    values
      (v_txn, v_wallet, -v_fare),
      (v_txn, v_escrow, v_fare);
  end if;

  v_valid_until := now() + make_interval(mins => p_valid_minutes);

  loop
    v_bytes := extensions.gen_random_bytes(2);
    v_code := lpad((((get_byte(v_bytes, 0) << 8) | get_byte(v_bytes, 1)) % 10000)::text, 4, '0');
    begin
      insert into public.board_codes (ticket_id, route_id, direction, code, valid_until)
      values (v_ticket, p_route, p_direction, v_code, v_valid_until);
      exit;
    exception when exclusion_violation then
      v_tries := v_tries + 1;
      if v_tries >= 25 then
        raise exception 'could not allocate a board code, try again';
      end if;
    end;
  end loop;

  return query select v_ticket, v_code, v_fare, v_valid_until;
end;
$$;

revoke execute on function public.purchase_ticket(uuid, public.route_direction, integer, uuid, uuid, text) from public, anon;
grant execute on function public.purchase_ticket(uuid, public.route_direction, integer, uuid, uuid, text) to authenticated;

-- redeem v2: cash reservations redeem without touching the ledger (the note
-- is handed over on the kombi); wallet tickets settle escrow into the owner
-- wallet and conductor commission exactly as before.
create or replace function public.redeem_board_code(
  p_route uuid,
  p_direction public.route_direction,
  p_code text,
  p_vehicle uuid default null
)
returns table (outcome text, ticket_id uuid)
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
    return query select 'rate_limited'::text, null::uuid;
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
    return query select 'invalid_code'::text, null::uuid;
    return;
  end if;

  -- serialise per ticket, then re-check status under the lock
  perform pg_advisory_xact_lock(hashtextextended(v_bc.ticket_id::text, 7));

  select e.event_type into v_status
  from public.ticket_events e
  where e.ticket_id = v_bc.ticket_id
  order by e.created_at desc, e.id desc
  limit 1;
  if v_status is distinct from 'issued' then
    insert into public.code_redemption_attempts (conductor_id, route_id, direction, code_entered, outcome, ticket_id)
    values (v_conductor.id, p_route, p_direction, p_code, 'already_redeemed', v_bc.ticket_id);
    return query select 'already_redeemed'::text, v_bc.ticket_id;
    return;
  end if;

  select * into v_ticket from public.tickets t where t.id = v_bc.ticket_id;

  if v_ticket.payment_method = 'wallet' then
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
    values ('fare_settlement', v_bc.ticket_id, 'fare settlement on redemption', v_uid)
    returning id into v_txn;

    insert into public.ledger_postings (transaction_id, account_id, amount_cents)
    values (v_txn, v_escrow, -v_fare), (v_txn, v_owner_wallet, v_owner_amount);
    if v_commission > 0 then
      insert into public.ledger_postings (transaction_id, account_id, amount_cents)
      values (v_txn, v_conductor_wallet, v_commission);
    end if;
  end if;

  insert into public.ticket_events (ticket_id, event_type, actor_profile_id, conductor_id, vehicle_id, detail)
  values (v_bc.ticket_id, 'redeemed', v_uid, v_conductor.id, p_vehicle,
          jsonb_build_object('payment_method', v_ticket.payment_method));

  insert into public.code_redemption_attempts (conductor_id, route_id, direction, code_entered, outcome, ticket_id)
  values (v_conductor.id, p_route, p_direction, p_code, 'success', v_bc.ticket_id);

  return query select 'success'::text, v_bc.ticket_id;
end;
$$;

revoke execute on function public.redeem_board_code(uuid, public.route_direction, text, uuid) from public, anon;
grant execute on function public.redeem_board_code(uuid, public.route_direction, text, uuid) to authenticated;
