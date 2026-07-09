-- 0019 ride data pipeline
-- Raw field GPS journeys and the per segment travel times derived from them.
-- This is the data spine 1 (arrival prediction) trains on. Three tables:
--
--   journeys       one row per recorded ride, keyed by the gps-logger journey
--                  id (source_ref) so re-ingesting the same bundle is a no op.
--                  A journey belongs to the profile that uploaded it.
--   gps_pings      the raw pings exactly as the phone recorded them. A ride
--                  trace is a person's movement, so pings are visible only to
--                  the journey's uploader.
--   segment_times  derived rows: how long the vehicle took between two
--                  adjacent seeded stops, bucketed by local Harare hour.
--                  No personal data (stop pair, duration, hour), and it feeds
--                  rider facing arrival estimates, so it is world readable
--                  like the network tables.
--
-- Every source column carries the honesty flag: real_field_ride (recorded on
-- a kombi), synthetic (simulator, generation documented), demo_sim (demo
-- theatre). Writes happen only through the data pipeline scripts (seed and
-- spine:ingest) with the service role; authenticated and anon cannot write.
-- RLS is enabled on every table in this migration, in this migration.

create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  source_ref text not null unique,
  label text not null default '',
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  route_id uuid not null references public.routes (id) on delete restrict,
  direction public.route_direction not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  source text not null check (source in ('real_field_ride', 'synthetic', 'demo_sim')),
  created_at timestamptz not null default now()
);

alter table public.journeys enable row level security;

create policy "journeys select own"
  on public.journeys for select
  to authenticated
  using (uploaded_by = (select auth.uid()));

create table public.gps_pings (
  id bigint generated always as identity primary key,
  journey_id uuid not null references public.journeys (id) on delete cascade,
  seq integer not null check (seq >= 0),
  leg_index integer not null check (leg_index >= 0),
  mode text not null check (mode in ('walking', 'riding')),
  recorded_at timestamptz not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m double precision,
  speed_mps double precision,
  heading_deg double precision,
  altitude_m double precision,
  source text not null check (source in ('real_field_ride', 'synthetic', 'demo_sim')),
  unique (journey_id, seq)
);

alter table public.gps_pings enable row level security;

create policy "gps_pings select own journey"
  on public.gps_pings for select
  to authenticated
  using (
    exists (
      select 1 from public.journeys j
      where j.id = journey_id
        and j.uploaded_by = (select auth.uid())
    )
  );

create table public.segment_times (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  direction public.route_direction not null,
  from_stop_id uuid not null references public.stops (id) on delete restrict,
  to_stop_id uuid not null references public.stops (id) on delete restrict,
  -- local Harare hour (UTC+2, no DST) of the moment the vehicle left from_stop
  hour_bucket integer not null check (hour_bucket between 0 and 23),
  duration_seconds integer not null check (duration_seconds > 0),
  journey_id uuid not null references public.journeys (id) on delete cascade,
  source text not null check (source in ('real_field_ride', 'synthetic', 'demo_sim')),
  created_at timestamptz not null default now(),
  check (from_stop_id <> to_stop_id),
  unique (journey_id, from_stop_id, to_stop_id)
);

create index segment_times_lookup_idx
  on public.segment_times (route_id, direction, from_stop_id, to_stop_id, hour_bucket);

alter table public.segment_times enable row level security;

create policy "segment_times public read"
  on public.segment_times for select
  to anon, authenticated
  using (true);

-- pipeline tables are written only by the seed and ingest scripts (service role)
revoke insert, update, delete on table public.journeys, public.gps_pings, public.segment_times from authenticated, anon;
