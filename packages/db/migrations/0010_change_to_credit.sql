-- 0010 change to credit
-- The product's founding move: unreturned change on a cash fare becomes USD
-- wallet credit instead of leaving with the kombi. The conductor who cleared
-- the ticket records which note the rider paid with and how many fares it
-- covered (one payer covering companions is normal practice); the difference
-- is credited to the rider's wallet through the ledger, entering from the
-- external cash boundary exactly like a topup (the crew keeps the physical
-- note and acts as the cash-in agent, the InnBucks origin story on a kombi).
--
-- Rules: only the conductor who redeemed the ticket, only cash tickets,
-- only once per ticket, only real USD note denominations, change must be
-- positive. No mutable balance anywhere; it is one balanced transaction.
--
-- redeem_board_code now also returns fare_cents and payment_method so the
-- hwindi surface knows what to collect and whether change applies.

alter type public.ledger_txn_kind add value if not exists 'change_credit';

drop function public.redeem_board_code(uuid, public.route_direction, text, uuid);

create or replace function public.redeem_board_code(
  p_route uuid,
  p_direction public.route_direction,
  p_code text,
  p_vehicle uuid default null
)
returns table (outcome text, ticket_id uuid, fare_cents integer, payment_method text)
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
    return query select 'rate_limited'::text, null::uuid, null::integer, null::text;
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
    return query select 'invalid_code'::text, null::uuid, null::integer, null::text;
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
    return query select 'already_redeemed'::text, v_bc.ticket_id, null::integer, null::text;
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

  return query select 'success'::text, v_bc.ticket_id, v_ticket.fare_cents, v_ticket.payment_method;
end;
$$;

revoke execute on function public.redeem_board_code(uuid, public.route_direction, text, uuid) from public, anon;
grant execute on function public.redeem_board_code(uuid, public.route_direction, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- record_change_credit: the change problem, solved through the ledger.
-- ---------------------------------------------------------------------------
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

  -- real USD note denominations only; a mistyped note is refused, not rounded
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

  -- serialise with redemption and with a concurrent duplicate credit
  perform pg_advisory_xact_lock(hashtextextended(p_ticket::text, 7));

  -- only the conductor who cleared this ticket may credit its change
  perform 1 from public.ticket_events e
  where e.ticket_id = p_ticket
    and e.event_type = 'redeemed'
    and e.conductor_id = v_conductor.id;
  if not found then
    raise exception 'ticket was not cleared by you';
  end if;

  -- once per ticket
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
