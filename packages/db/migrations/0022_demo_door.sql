-- The demo door: judges enter as pooled demo personas on the same backend,
-- with every demo row keyed to a demo_sim profile and isolated from real
-- rows by exactly the RLS that isolates any user. The pool is claimed and
-- reset through security definer functions; clients never touch the pool
-- tables directly, and the service role key stays out of app code.

-- demo accounts are flagged at the profile, so every row they own is
-- attributable as demo data with one join
alter table public.profiles
  add column demo_sim boolean not null default false;

-- the pool of demo rider personas the landing page door hands out.
-- Rows are written by the seed script only.
create table public.demo_pool (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  persona text not null,
  email text not null unique,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.demo_pool enable row level security;
revoke all on table public.demo_pool from anon, authenticated;

-- rate limiting for the public door: one row per claim attempt
create table public.demo_door_attempts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);

alter table public.demo_door_attempts enable row level security;
revoke all on table public.demo_door_attempts from anon, authenticated;

-- Hands out the least recently used persona. Public by design (the landing
-- page calls it before any sign in), so it is rate limited and returns
-- nothing but the persona's sign in email; the password is a server secret.
create or replace function public.claim_demo_persona()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent int;
  v_email text;
begin
  select count(*) into v_recent
  from public.demo_door_attempts
  where created_at > now() - interval '10 minutes';
  if v_recent >= 40 then
    raise exception 'demo door is busy, try again in a few minutes';
  end if;
  insert into public.demo_door_attempts default values;

  select email into v_email
  from public.demo_pool
  order by claimed_at asc nulls first
  limit 1
  for update skip locked;
  if v_email is null then
    raise exception 'no demo personas are seeded';
  end if;

  update public.demo_pool set claimed_at = now() where email = v_email;
  return v_email;
end;
$$;

revoke execute on function public.claim_demo_persona() from public;
grant execute on function public.claim_demo_persona() to anon, authenticated;

-- Resets the signed in demo persona to its fixture state: persona name,
-- fresh consent, a standard wallet float and the one saved trip to town.
-- Money history is append only, so the float is corrected with a proper
-- double entry adjustment against external_cash, never by editing rows.
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
  delete from public.consent_records where user_id = v_uid;
  insert into public.consent_records (user_id, action, version)
  values (v_uid, 'accepted', p_consent_version);

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
