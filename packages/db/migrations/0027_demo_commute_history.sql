-- 0027 demo commute history
-- Takunda is the commute alert demo persona: a believable two week ride
-- history that the pattern miner can chew on. History is fixture data and
-- says so in a table: every synthetic ticket is enumerated in
-- demo_commute_fixtures, and the reset deletes exactly those rows and
-- nothing else, so real append only history is never touched. Rebuilding
-- with times relative to now keeps the mined window live for the demo.
-- Only demo_sim profiles can carry fixture history, and an authenticated
-- caller can only rebuild their own.

create table public.demo_commute_fixtures (
  ticket_id uuid primary key references public.tickets (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index demo_commute_fixtures_profile_idx
  on public.demo_commute_fixtures (profile_id);

alter table public.demo_commute_fixtures enable row level security;
revoke all on table public.demo_commute_fixtures from anon, authenticated;

-- Rebuilds the persona's synthetic ride history: drops the previous fixture
-- tickets (and only those), then inserts one cash fare per element of
-- p_rides ({"at": iso timestamp}), each issued and redeemed so the history
-- reads as completed rides. No ledger rows: no money moved for fixtures,
-- which the disclosure register records.
create or replace function public.reset_demo_commute_history(
  p_profile uuid,
  p_route uuid,
  p_direction public.route_direction,
  p_from uuid,
  p_to uuid,
  p_fare_cents integer,
  p_rides jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_demo boolean;
  v_ride jsonb;
  v_at timestamptz;
  v_ticket uuid;
  v_count integer := 0;
begin
  if v_uid is not null and v_uid <> p_profile then
    raise exception 'not your history';
  end if;
  select demo_sim into v_demo from public.profiles where id = p_profile;
  if v_demo is distinct from true then
    raise exception 'fixture history is for demo profiles only';
  end if;
  if jsonb_typeof(p_rides) <> 'array' or jsonb_array_length(p_rides) > 60 then
    raise exception 'p_rides must be an array of at most 60 rides';
  end if;
  if p_fare_cents is null or p_fare_cents <= 0 or p_fare_cents > 1000 then
    raise exception 'implausible fixture fare';
  end if;

  perform set_config('svika.allow_maintenance', 'on', true);

  delete from public.ticket_events
    where ticket_id in (
      select ticket_id from public.demo_commute_fixtures
      where profile_id = p_profile
    );
  delete from public.tickets
    where id in (
      select ticket_id from public.demo_commute_fixtures
      where profile_id = p_profile
    );

  for v_ride in select * from jsonb_array_elements(p_rides) loop
    v_at := (v_ride ->> 'at')::timestamptz;
    if v_at is null or v_at > now() then
      raise exception 'fixture rides must sit in the past';
    end if;
    insert into public.tickets
      (rider_id, route_id, direction, from_stop_id, to_stop_id,
       fare_cents, payment_method, kind, purchased_at)
    values
      (p_profile, p_route, p_direction, p_from, p_to,
       p_fare_cents, 'cash', 'fare', v_at)
    returning id into v_ticket;
    insert into public.ticket_events (ticket_id, event_type, actor_profile_id, created_at)
      values (v_ticket, 'issued', p_profile, v_at),
             (v_ticket, 'redeemed', p_profile, v_at + interval '4 minutes');
    insert into public.demo_commute_fixtures (ticket_id, profile_id)
      values (v_ticket, p_profile);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function
  public.reset_demo_commute_history(uuid, uuid, public.route_direction, uuid, uuid, integer, jsonb)
  from public, anon;
grant execute on function
  public.reset_demo_commute_history(uuid, uuid, public.route_direction, uuid, uuid, integer, jsonb)
  to authenticated, service_role;
