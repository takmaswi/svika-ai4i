-- 0001 identity and fleet
-- Every profile is a rider by default. Conductors and owners are role
-- extension tables keyed to profiles, so one person can hold several roles
-- (an owner who rides is one profile with an owners row).
-- RLS is enabled on every table in this migration, in this migration.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- Shared guard for append only tables. History is never rewritten.
-- Service role maintenance (test cleanup only) must opt in explicitly via
-- set_config('svika.allow_maintenance','on',true). Regular users are stopped
-- by RLS long before this trigger; this is a second wall, not the first.
create or replace function public.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('svika.allow_maintenance', true), '') = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  raise exception '%.% is append only: % is not allowed', tg_table_schema, tg_table_name, tg_op;
end;
$$;

create type public.app_language as enum ('en', 'sn');

-- profiles: one row per auth user, created by trigger on signup
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  preferred_language public.app_language not null default 'en',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles select own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles update own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- column level: users may edit their name, phone and language, nothing else
revoke update on table public.profiles from authenticated, anon;
grant update (full_name, phone, preferred_language) on table public.profiles to authenticated;

-- owners: fleet owners (onboarded by the service, not self signup)
create table public.owners (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.owners enable row level security;

create policy "owners select own"
  on public.owners for select
  to authenticated
  using (profile_id = (select auth.uid()));

-- helper used by policies below; security definer avoids policy recursion
create or replace function public.current_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.owners where profile_id = auth.uid();
$$;

-- conductors: work a vehicle for one owner, earn commission on digital fares.
-- commission_rate_bps defaults to 0; real rates are seeded from fieldwork,
-- never invented here.
create table public.conductors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  owner_id uuid not null references public.owners (id) on delete restrict,
  commission_rate_bps integer not null default 0
    check (commission_rate_bps between 0 and 10000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.conductors enable row level security;

create policy "conductors select own or fleet"
  on public.conductors for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or owner_id = (select public.current_owner_id())
  );

-- vehicles: the owner's kombis. capacity is seeded from fieldwork, no
-- invented default.
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (id) on delete restrict,
  plate text not null unique,
  capacity smallint check (capacity between 1 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.vehicles enable row level security;

create policy "vehicles select own fleet"
  on public.vehicles for select
  to authenticated
  using (owner_id = (select public.current_owner_id()));

-- profile bootstrap on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.phone
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- writes to owners, conductors and vehicles happen through the service
-- (onboarding flows land in a later phase); no write policies means
-- authenticated users cannot write these tables at all.
revoke insert, update, delete on table public.owners, public.conductors, public.vehicles from authenticated, anon;
