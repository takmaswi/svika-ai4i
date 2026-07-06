-- 0016 offline sync hardening (from the P2 security review)
--
-- Two findings, both defence in depth on the new sync RPCs:
--
--   1. Receipt lookups are now scoped to the calling conductor. A client
--      event id is an unguessable UUID, but a replay of someone else's id
--      must not answer with their outcome; it raises instead.
--
--   2. sync_offline_change_credit no longer stores raw sqlerrm in the
--      conductor readable receipt. Failure reasons map to a coarse fixed
--      vocabulary; the shape of internal errors stays server side.
--
-- (Reviewed and kept as designed: per pull random salts in
-- pull_offline_cache are intentional, so two pulls can never be joined into
-- a rainbow table; consumed markers key on ticket id, not on the hash.)

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
    if v_receipt.conductor_id <> v_conductor.id then
      raise exception 'sync event belongs to another conductor';
    end if;
    return query select
      v_receipt.outcome,
      (v_receipt.detail ->> 'change_cents')::integer;
    return;
  end if;

  begin
    select rcc.change_cents into v_change
    from public.record_change_credit(p_ticket, p_note_cents, p_covered_fares) rcc;
  exception when others then
    -- coarse, fixed vocabulary in the conductor readable receipt; raw
    -- error text never leaves the server
    v_reason := case
      when sqlerrm like '%already credited%' then 'already_credited'
      when sqlerrm like '%not cleared by you%' then 'not_your_clear'
      when sqlerrm like '%cash fares only%' then 'not_cash'
      when sqlerrm like '%no change%' then 'no_change'
      else 'rejected'
    end;
    if v_reason = 'already_credited' then
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

-- grants unchanged: authenticated only, anon revoked (create or replace
-- keeps the existing ACLs, restated here for the reader)
revoke execute on function public.sync_offline_redemption(uuid, uuid, public.route_direction, text, timestamptz, uuid) from public, anon;
grant execute on function public.sync_offline_redemption(uuid, uuid, public.route_direction, text, timestamptz, uuid) to authenticated;
revoke execute on function public.sync_offline_change_credit(uuid, uuid, integer, integer, timestamptz) from public, anon;
grant execute on function public.sync_offline_change_credit(uuid, uuid, integer, integer, timestamptz) to authenticated;
