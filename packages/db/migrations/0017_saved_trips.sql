-- 0017 saved trips
-- A rider can nickname a trip ("Town trip", "Work trip") and get it back as
-- a one-tap quick pick on the home map. Plain rider-owned data: no money, no
-- history, so direct client writes are allowed and RLS scopes every path to
-- the owning rider. RLS is enabled in this migration, on the table it creates.

create table public.saved_trips (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade,
  from_stop_id uuid not null references public.stops (id) on delete restrict,
  to_stop_id uuid not null references public.stops (id) on delete restrict,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 40),
  created_at timestamptz not null default now(),
  constraint saved_trips_distinct_stops check (from_stop_id <> to_stop_id),
  constraint saved_trips_one_per_pair unique (rider_id, from_stop_id, to_stop_id)
);

create index saved_trips_rider_idx on public.saved_trips (rider_id, created_at desc);

alter table public.saved_trips enable row level security;

create policy "saved trips select own"
  on public.saved_trips for select
  to authenticated
  using (rider_id = (select auth.uid()));

create policy "saved trips insert own"
  on public.saved_trips for insert
  to authenticated
  with check (rider_id = (select auth.uid()));

create policy "saved trips update own"
  on public.saved_trips for update
  to authenticated
  using (rider_id = (select auth.uid()))
  with check (rider_id = (select auth.uid()));

create policy "saved trips delete own"
  on public.saved_trips for delete
  to authenticated
  using (rider_id = (select auth.uid()));
