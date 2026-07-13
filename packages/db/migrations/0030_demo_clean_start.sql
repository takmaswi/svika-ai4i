-- 0030 demo clean start
-- Every judge who claims a pooled persona must land on a believable, empty
-- profile: no stranger's ride stats, no stale board code from the last visit.
-- Deleting is not an option here. Tickets are event sourced and the ledger is
-- append only (a purchased ticket is referenced by its ledger rows with
-- on delete restrict), so we never remove a real ride. Instead:
--   1. a per visit window (the pool row's claimed_at) hides earlier visits'
--      rides from the profile stats, exposed to the persona by my_demo_since();
--   2. any ticket a previous judge left 'issued' is retired with an appended
--      'expired' event, so nothing live leaks onto the home screen.
-- Fixture history (Takunda's two weeks) is untouched: named personas are not
-- in demo_pool, so my_demo_since() returns null and no window is applied.

-- The caller's per visit cutoff: when they claimed their pooled persona. Null
-- for anyone who is not a pooled demo persona (named personas, real riders),
-- so the profile applies no window and their real history shows in full.
create or replace function public.my_demo_since()
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  select claimed_at from public.demo_pool where profile_id = (select auth.uid());
$$;

revoke execute on function public.my_demo_since() from public, anon;
grant execute on function public.my_demo_since() to authenticated;

-- Same body as 0023 plus one appended step: retire any ticket a previous judge
-- left 'issued' on this pooled persona (append only, never a delete or update).
create or replace function public.demo_reset_mine(p_consent_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_persona text;
  v_wallet uuid;
  v_balance bigint;
  v_diff bigint;
  v_cash uuid;
  v_txn uuid;
  v_route uuid;
  v_from uuid;
  v_to uuid;
  c_float constant bigint := 500; -- $5.00 demo float
begin
  select persona into v_persona
  from public.demo_pool where profile_id = v_uid;
  if v_persona is null then
    raise exception 'not a demo persona';
  end if;

  update public.profiles
  set full_name = v_persona, phone = null, anonymised_at = null
  where id = v_uid;

  delete from public.saved_trips where rider_id = v_uid;
  delete from public.rider_prefs where rider_id = v_uid;
  delete from public.emergency_details where rider_id = v_uid;
  delete from public.consent_records where user_id = v_uid;
  insert into public.consent_records (user_id, action, version)
  values (v_uid, 'accepted', p_consent_version);

  -- retire tickets a previous judge left live, so the home screen starts clean.
  -- Append only: we add an 'expired' event, we never touch ticket history.
  insert into public.ticket_events (ticket_id, event_type, actor_profile_id)
  select t.id, 'expired', v_uid
  from public.tickets t
  where t.rider_id = v_uid
    and t.kind = 'fare'
    and (
      select e.event_type
      from public.ticket_events e
      where e.ticket_id = t.id
      order by e.created_at desc, e.id desc
      limit 1
    ) = 'issued';

  -- wallet float to exactly c_float, double entry against external_cash
  select id into v_wallet
  from public.ledger_accounts
  where profile_id = v_uid and kind = 'rider_wallet';
  if v_wallet is null then
    raise exception 'demo persona has no wallet';
  end if;
  select coalesce(sum(amount_cents), 0) into v_balance
  from public.ledger_postings where account_id = v_wallet;
  v_diff := c_float - v_balance;
  if v_diff <> 0 then
    select id into v_cash
    from public.ledger_accounts
    where kind = 'external_cash' and profile_id is null;
    insert into public.ledger_transactions (kind, memo, created_by)
    values ('adjustment', 'demo reset float', v_uid)
    returning id into v_txn;
    insert into public.ledger_postings (transaction_id, account_id, amount_cents)
    values (v_txn, v_wallet, v_diff), (v_txn, v_cash, -v_diff);
  end if;

  -- the persona's one saved trip: the corridor end to end, toward town
  select r.id into v_route from public.routes r where r.code = 'HEIGHTS-REZENDE';
  if v_route is not null then
    select rs.stop_id into v_from
    from public.route_stops rs
    where rs.route_id = v_route and rs.direction = 'outbound'
    order by rs.seq asc limit 1;
    select rs.stop_id into v_to
    from public.route_stops rs
    where rs.route_id = v_route and rs.direction = 'outbound'
    order by rs.seq desc limit 1;
    if v_from is not null and v_to is not null then
      insert into public.saved_trips (rider_id, from_stop_id, to_stop_id, nickname)
      values (v_uid, v_from, v_to, 'Kutown')
      on conflict (rider_id, from_stop_id, to_stop_id)
      do update set nickname = excluded.nickname;
    end if;
  end if;
end;
$$;

revoke execute on function public.demo_reset_mine(text) from public, anon;
grant execute on function public.demo_reset_mine(text) to authenticated;

-- The operator's one command hard reset between judging sessions: retire every
-- demo persona's live tickets, level every demo wallet back to the $5 float and
-- free the whole pool so the next judge draws a clean persona. Service role
-- only (the same key the seed uses); no ticket or ledger row is ever deleted.
create or replace function public.demo_reset_all()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_touched integer := 0;
  v_wallet uuid;
  v_balance bigint;
  v_diff bigint;
  v_cash uuid;
  v_txn uuid;
  c_float constant bigint := 500;
begin
  select id into v_cash
  from public.ledger_accounts
  where kind = 'external_cash' and profile_id is null;

  for v_row in
    select id from public.profiles where demo_sim = true
  loop
    -- retire live tickets (append only)
    insert into public.ticket_events (ticket_id, event_type, actor_profile_id)
    select t.id, 'expired', v_row.id
    from public.tickets t
    where t.rider_id = v_row.id
      and t.kind = 'fare'
      and (
        select e.event_type
        from public.ticket_events e
        where e.ticket_id = t.id
        order by e.created_at desc, e.id desc
        limit 1
      ) = 'issued';

    -- level the wallet back to the $5 float via a balanced adjustment. Named
    -- personas that want a different float (Rudo's empty wallet) re-set it on
    -- their own entry; this is the neutral baseline.
    select id into v_wallet
    from public.ledger_accounts
    where profile_id = v_row.id and kind = 'rider_wallet';
    if v_wallet is not null and v_cash is not null then
      select coalesce(sum(amount_cents), 0) into v_balance
      from public.ledger_postings where account_id = v_wallet;
      v_diff := c_float - v_balance;
      if v_diff <> 0 then
        insert into public.ledger_transactions (kind, memo, created_by)
        values ('adjustment', 'demo reset all float', v_row.id)
        returning id into v_txn;
        insert into public.ledger_postings (transaction_id, account_id, amount_cents)
        values (v_txn, v_wallet, v_diff), (v_txn, v_cash, -v_diff);
      end if;
    end if;

    v_touched := v_touched + 1;
  end loop;

  -- free the pool: a null claim is the least recently used, and the next claim
  -- stamps a fresh per visit window
  update public.demo_pool set claimed_at = null;

  return v_touched;
end;
$$;

revoke execute on function public.demo_reset_all() from public, anon, authenticated;
grant execute on function public.demo_reset_all() to service_role;
