-- 0023 rider prefs and emergency details
-- The profile page's two data homes. rider_prefs is plain rider owned
-- settings (commute alerts, the voice guide per language), direct client
-- writes under RLS like saved_trips. emergency_details is sensitive personal
-- data (next of kin, medical aid): clients can only read their own row;
-- every write goes through a security definer RPC that records consent in
-- the same transaction, so a details row cannot exist without a recorded
-- consent. RLS is enabled on both tables in this migration, at creation.

create table public.rider_prefs (
  rider_id uuid primary key references public.profiles (id) on delete cascade,
  commute_alerts boolean not null default false,
  voice_en boolean not null default false,
  voice_sn boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.rider_prefs enable row level security;

create policy "rider prefs select own"
  on public.rider_prefs for select
  to authenticated
  using (rider_id = (select auth.uid()));

create policy "rider prefs insert own"
  on public.rider_prefs for insert
  to authenticated
  with check (rider_id = (select auth.uid()));

create policy "rider prefs update own"
  on public.rider_prefs for update
  to authenticated
  using (rider_id = (select auth.uid()))
  with check (rider_id = (select auth.uid()));

create policy "rider prefs delete own"
  on public.rider_prefs for delete
  to authenticated
  using (rider_id = (select auth.uid()));

-- clients write only the three toggles; updated_at moves with every write
revoke insert, update on table public.rider_prefs from authenticated, anon;
grant insert (rider_id, commute_alerts, voice_en, voice_sn)
  on table public.rider_prefs to authenticated;
grant update (commute_alerts, voice_en, voice_sn)
  on table public.rider_prefs to authenticated;

create or replace function public.touch_rider_prefs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger rider_prefs_touch
  before update on public.rider_prefs
  for each row execute function public.touch_rider_prefs();

-- emergency details: who to call and which medical aid, offered voluntarily
-- and stored only after an explicit recorded consent
create table public.emergency_details (
  rider_id uuid primary key references public.profiles (id) on delete cascade,
  next_of_kin_name text check (next_of_kin_name is null or char_length(btrim(next_of_kin_name)) between 1 and 80),
  next_of_kin_phone text check (next_of_kin_phone is null or char_length(btrim(next_of_kin_phone)) between 5 and 30),
  medical_aid_name text check (medical_aid_name is null or char_length(btrim(medical_aid_name)) between 1 and 80),
  medical_aid_number text check (medical_aid_number is null or char_length(btrim(medical_aid_number)) between 1 and 40),
  updated_at timestamptz not null default now(),
  constraint emergency_details_not_empty check (
    next_of_kin_name is not null
    or next_of_kin_phone is not null
    or medical_aid_name is not null
    or medical_aid_number is not null
  )
);

alter table public.emergency_details enable row level security;

create policy "emergency details select own"
  on public.emergency_details for select
  to authenticated
  using (rider_id = (select auth.uid()));

-- no insert/update/delete policies and no write grants: the RPCs below are
-- the only write path, so consent is recorded with the data or not at all
revoke insert, update, delete on table public.emergency_details from anon, authenticated;

-- Saves (or replaces) the caller's emergency details and appends the consent
-- record in the same transaction. Empty strings mean "not given".
create or replace function public.save_emergency_details(
  p_next_of_kin_name text,
  p_next_of_kin_phone text,
  p_medical_aid_name text,
  p_medical_aid_number text,
  p_consent_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_kin_name text := nullif(btrim(coalesce(p_next_of_kin_name, '')), '');
  v_kin_phone text := nullif(btrim(coalesce(p_next_of_kin_phone, '')), '');
  v_aid_name text := nullif(btrim(coalesce(p_medical_aid_name, '')), '');
  v_aid_number text := nullif(btrim(coalesce(p_medical_aid_number, '')), '');
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if v_kin_name is null and v_kin_phone is null
     and v_aid_name is null and v_aid_number is null then
    raise exception 'nothing to save';
  end if;

  insert into public.emergency_details
    (rider_id, next_of_kin_name, next_of_kin_phone, medical_aid_name, medical_aid_number)
  values (v_uid, v_kin_name, v_kin_phone, v_aid_name, v_aid_number)
  on conflict (rider_id) do update
    set next_of_kin_name = excluded.next_of_kin_name,
        next_of_kin_phone = excluded.next_of_kin_phone,
        medical_aid_name = excluded.medical_aid_name,
        medical_aid_number = excluded.medical_aid_number,
        updated_at = now();

  insert into public.consent_records (user_id, action, version)
  values (v_uid, 'accepted', p_consent_version);
end;
$$;

revoke execute on function public.save_emergency_details(text, text, text, text, text) from public, anon;
grant execute on function public.save_emergency_details(text, text, text, text, text) to authenticated;

-- Removes the caller's emergency details and records the withdrawal.
create or replace function public.delete_emergency_details(p_consent_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  delete from public.emergency_details where rider_id = v_uid;
  insert into public.consent_records (user_id, action, version)
  values (v_uid, 'withdrawn', p_consent_version);
end;
$$;

revoke execute on function public.delete_emergency_details(text) from public, anon;
grant execute on function public.delete_emergency_details(text) to authenticated;

-- Deleting your data now also drops prefs and emergency details.
create or replace function public.anonymise_me()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_version text;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select version into v_version
    from public.consent_records
    where user_id = v_uid and action = 'accepted'
    order by created_at desc
    limit 1;

  update public.profiles
    set full_name = '', phone = null, anonymised_at = now()
    where id = v_uid;

  delete from public.saved_trips where rider_id = v_uid;
  delete from public.rider_prefs where rider_id = v_uid;
  delete from public.emergency_details where rider_id = v_uid;

  insert into public.consent_records (user_id, action, version)
    values (v_uid, 'withdrawn', coalesce(v_version, 'v1'));
end;
$$;

-- A fresh judge visit starts with clean prefs and no emergency details.
-- Same body as 0022 plus the two new deletes.
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
