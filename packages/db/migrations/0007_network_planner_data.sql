-- 0007 network v2: transfer points and dated fare segments
-- The planner needs two things 0002 did not have: walking links between
-- stops (transfer_points) and stop pair fares with effective dates
-- (fare_segments). Fares are an append only history; the fare in force for
-- a stop pair is the newest effective row. Real fares are seeded from the
-- evidence base (2026 post fuel hike levels), never invented in migrations.
-- RLS is enabled on every table in this migration, in this migration.

-- walking links the network knows about (rank to rank walks and the
-- tribal knowledge mid route junctions). Walks are symmetric; the planner
-- traverses them in both directions.
create table public.transfer_points (
  id uuid primary key default gen_random_uuid(),
  from_stop_id uuid not null references public.stops (id) on delete restrict,
  to_stop_id uuid not null references public.stops (id) on delete restrict,
  kind text not null check (kind in ('rank_to_rank_walk', 'walking_junction')),
  walk_meters integer not null check (walk_meters > 0),
  walk_minutes integer not null check (walk_minutes > 0),
  notes text,
  created_at timestamptz not null default now(),
  check (from_stop_id <> to_stop_id),
  unique (from_stop_id, to_stop_id)
);

alter table public.transfer_points enable row level security;

create policy "transfer_points public read"
  on public.transfer_points for select
  to anon, authenticated
  using (true);

-- dated stop pair fares. A pair is undirected (the fare Heights to UZ is
-- the fare UZ to Heights); rows are stored once in route order and looked
-- up in either order.
create table public.fare_segments (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  from_stop_id uuid not null references public.stops (id) on delete restrict,
  to_stop_id uuid not null references public.stops (id) on delete restrict,
  fare_cents integer not null check (fare_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (from_stop_id <> to_stop_id)
);

create index fare_segments_pair_idx
  on public.fare_segments (route_id, from_stop_id, to_stop_id, effective_from desc);

alter table public.fare_segments enable row level security;

create policy "fare_segments public read"
  on public.fare_segments for select
  to anon, authenticated
  using (true);

create trigger fare_segments_append_only
  before update or delete on public.fare_segments
  for each row execute function public.forbid_mutation();

-- the fare in force for a stop pair on a route (either order)
create or replace function public.segment_fare_cents(
  p_route uuid,
  p_from uuid,
  p_to uuid
)
returns integer
language sql
stable
set search_path = ''
as $$
  select fare_cents
  from public.fare_segments
  where route_id = p_route
    and (
      (from_stop_id = p_from and to_stop_id = p_to)
      or (from_stop_id = p_to and to_stop_id = p_from)
    )
    and effective_from <= now()
  order by effective_from desc
  limit 1;
$$;

-- network is written only by the seed script (service role)
revoke insert, update, delete on table public.transfer_points, public.fare_segments from authenticated, anon;
