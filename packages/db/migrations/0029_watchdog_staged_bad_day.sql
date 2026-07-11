-- 0029 watchdog staged bad day
-- Door three of the intelligence shelf injects the demo bad day live, and
-- the trust tier stays clean: all simulation and scoring keep happening in
-- the committed pipeline (services/spine/src/watchdog/run.ts, the same tier
-- as the seed script), which now stages BOTH variants of its end day here,
-- normal and bad_day, scored by whichever detector the committed metrics
-- verdict promoted. The demo owner's story swaps the visible end day between
-- variants through one security definer RPC: no service key near the app,
-- no scoring outside the pipeline, and only the caller's own synthetic rows
-- move. Live flag rows also gain the named baseline's verdict
-- (threshold_flagged) so the owner card can hold the fixed rule against the
-- forest on screen.

-- Staging mirrors of the two live tables, plus the variant. Service role
-- only: RLS is enabled and no policies exist, so no client reads or writes.
create table public.watchdog_staged_vehicle_days (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (id) on delete cascade,
  route_id uuid not null references public.routes (id) on delete cascade,
  variant text not null check (variant in ('normal', 'bad_day')),
  vehicle_label text not null,
  day date not null,
  tickets integer not null check (tickets >= 0),
  digital_tickets integer not null check (digital_tickets >= 0),
  peak_tickets integer not null check (peak_tickets >= 0),
  gross_cents integer not null check (gross_cents >= 0),
  injected_leakage text
    check (injected_leakage in ('heavy_skim', 'peak_skim', 'short_day')),
  created_at timestamptz not null default now(),
  check (digital_tickets <= tickets),
  check (peak_tickets <= tickets),
  unique (owner_id, route_id, variant, vehicle_label, day)
);

alter table public.watchdog_staged_vehicle_days enable row level security;

create table public.watchdog_staged_day_flags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (id) on delete cascade,
  route_id uuid not null references public.routes (id) on delete cascade,
  variant text not null check (variant in ('normal', 'bad_day')),
  day date not null,
  tickets integer not null check (tickets >= 0),
  tickets_ratio numeric not null,
  peak_share numeric not null,
  digital_share numeric not null,
  worst_vehicle_ratio numeric not null,
  score numeric not null,
  flagged boolean not null,
  threshold_flagged boolean not null default false,
  engine text not null check (engine in ('threshold:v1', 'forest:v1')),
  explanation_en text,
  explanation_sn text,
  injected_leakage text
    check (injected_leakage in ('heavy_skim', 'peak_skim', 'short_day')),
  created_at timestamptz not null default now(),
  unique (owner_id, route_id, variant, day)
);

alter table public.watchdog_staged_day_flags enable row level security;

-- The named baseline's verdict beside the forest's, per live day.
alter table public.watchdog_day_flags
  add column threshold_flagged boolean not null default false;

-- The swap: the caller must be a demo flagged owner, and only their own
-- staged end day rows move. Returns the swapped day.
create or replace function public.demo_watchdog_set_day(p_variant text)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_demo boolean;
  v_owner uuid;
  v_day date;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  select demo_sim into v_demo from public.profiles where id = v_uid;
  if v_demo is distinct from true then
    raise exception 'demo watchdog swaps are for demo profiles only';
  end if;
  select id into v_owner from public.owners where profile_id = v_uid;
  if v_owner is null then
    raise exception 'caller is not an owner';
  end if;
  if p_variant not in ('normal', 'bad_day') then
    raise exception 'unknown variant';
  end if;

  select max(day) into v_day
  from public.watchdog_staged_day_flags
  where owner_id = v_owner;
  if v_day is null then
    raise exception 'no staged watchdog day; run the watchdog pipeline first';
  end if;

  delete from public.watchdog_vehicle_days w
  where w.owner_id = v_owner
    and w.day = v_day
    and w.route_id in (
      select s.route_id
      from public.watchdog_staged_vehicle_days s
      where s.owner_id = v_owner
    );
  delete from public.watchdog_day_flags w
  where w.owner_id = v_owner
    and w.day = v_day
    and w.route_id in (
      select s.route_id
      from public.watchdog_staged_day_flags s
      where s.owner_id = v_owner
    );

  insert into public.watchdog_vehicle_days
    (owner_id, route_id, vehicle_label, day, tickets, digital_tickets,
     peak_tickets, gross_cents, injected_leakage)
  select owner_id, route_id, vehicle_label, day, tickets, digital_tickets,
         peak_tickets, gross_cents, injected_leakage
  from public.watchdog_staged_vehicle_days
  where owner_id = v_owner and variant = p_variant and day = v_day;

  insert into public.watchdog_day_flags
    (owner_id, route_id, day, tickets, tickets_ratio, peak_share,
     digital_share, worst_vehicle_ratio, score, flagged, threshold_flagged,
     engine, explanation_en, explanation_sn, injected_leakage)
  select owner_id, route_id, day, tickets, tickets_ratio, peak_share,
         digital_share, worst_vehicle_ratio, score, flagged, threshold_flagged,
         engine, explanation_en, explanation_sn, injected_leakage
  from public.watchdog_staged_day_flags
  where owner_id = v_owner and variant = p_variant and day = v_day;

  return v_day;
end;
$$;

revoke execute on function public.demo_watchdog_set_day(text) from public, anon;
grant execute on function public.demo_watchdog_set_day(text) to authenticated;
