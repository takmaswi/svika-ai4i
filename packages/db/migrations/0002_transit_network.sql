-- 0002 transit network
-- Routes, stops and fares for the seeded kombi network. The planner works
-- before login, so the network is world readable (anon + authenticated).
-- Real route names, stops and fares are seeded from Mhofu's corridor data,
-- never invented in migrations. Fares are an append only history table so
-- fare changes never rewrite the past (tickets also denormalise the fare
-- they were sold at).
-- RLS is enabled on every table in this migration, in this migration.

create type public.route_direction as enum ('outbound', 'inbound');

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  name_sn text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.routes enable row level security;

create policy "routes public read"
  on public.routes for select
  to anon, authenticated
  using (true);

create table public.stops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_sn text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now()
);

alter table public.stops enable row level security;

create policy "stops public read"
  on public.stops for select
  to anon, authenticated
  using (true);

-- ordered stop sequence per route per direction
create table public.route_stops (
  route_id uuid not null references public.routes (id) on delete cascade,
  stop_id uuid not null references public.stops (id) on delete restrict,
  direction public.route_direction not null,
  seq integer not null check (seq >= 0),
  primary key (route_id, direction, seq),
  unique (route_id, direction, stop_id)
);

alter table public.route_stops enable row level security;

create policy "route_stops public read"
  on public.route_stops for select
  to anon, authenticated
  using (true);

-- append only fare history; the fare in force is the newest effective row
create table public.route_fares (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  fare_cents integer not null check (fare_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.route_fares enable row level security;

create policy "route_fares public read"
  on public.route_fares for select
  to anon, authenticated
  using (true);

create trigger route_fares_append_only
  before update or delete on public.route_fares
  for each row execute function public.forbid_mutation();

create or replace function public.current_fare_cents(p_route uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select fare_cents
  from public.route_fares
  where route_id = p_route
    and effective_from <= now()
  order by effective_from desc
  limit 1;
$$;

-- network is written only by the seed script (service role)
revoke insert, update, delete on table public.routes, public.stops, public.route_stops, public.route_fares from authenticated, anon;
