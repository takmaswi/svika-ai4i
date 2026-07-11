-- 0026 ride shares
-- "Share my ride": a rider with a live fare mints an unguessable link;
-- whoever holds it sees the trip's route, live positions and arrival
-- estimate on a public page, no account needed, and nothing about who is
-- riding. Tokens are 128 bit hex minted server side. Clients have no write
-- path into the table: create and revoke are security definer RPCs, and the
-- anonymous viewer reads through a single RPC that answers only for a live,
-- unrevoked, unexpired token. The link dies when the trip does: a share
-- stops answering when the ticket leaves issued/redeemed or when the ride
-- window (code validity plus the route's typical duration) has passed.
-- RLS is enabled on the table this migration creates, in this migration.

create table public.ride_shares (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique check (char_length(token) = 32),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index ride_shares_ticket_idx on public.ride_shares (ticket_id);
create index ride_shares_rider_idx on public.ride_shares (rider_id, created_at desc);

alter table public.ride_shares enable row level security;

-- the owning rider sees their own shares (to show and revoke them);
-- no direct write policies or grants: the RPCs below are the only doors
create policy "ride shares select own"
  on public.ride_shares for select
  to authenticated
  using (rider_id = (select auth.uid()));

revoke insert, update, delete on table public.ride_shares from anon, authenticated;

-- Mints (or returns the existing live) share for the caller's own active
-- fare. Idempotent per ticket while the share lives.
create or replace function public.create_ride_share(p_ticket uuid)
returns table (share_token text, share_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rider uuid;
  v_kind text;
  v_route uuid;
  v_status text;
  v_valid_until timestamptz;
  v_typical integer;
  v_expires timestamptz;
  v_token text;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select t.rider_id, t.kind, t.route_id into v_rider, v_kind, v_route
    from public.tickets t where t.id = p_ticket;
  if v_rider is null or v_rider <> v_uid then
    raise exception 'not your ticket';
  end if;
  if v_kind <> 'fare' then
    raise exception 'only fares can be shared';
  end if;

  select ts.status into v_status
    from public.ticket_status ts where ts.ticket_id = p_ticket;
  if v_status not in ('issued', 'redeemed') then
    raise exception 'the trip has ended';
  end if;

  -- a live share already exists: hand the same link back
  select rs.token, rs.expires_at into v_token, v_expires
    from public.ride_shares rs
    where rs.ticket_id = p_ticket
      and rs.revoked_at is null
      and rs.expires_at > now()
    order by rs.created_at desc
    limit 1;
  if v_token is not null then
    return query select v_token, v_expires;
    return;
  end if;

  -- the ride window: the code can be used until valid_until, and the ride
  -- itself takes at most the route's typical duration (fallback 60 min)
  select max(bc.valid_until) into v_valid_until
    from public.board_codes bc where bc.ticket_id = p_ticket;
  select r.typical_duration_minutes into v_typical
    from public.routes r where r.id = v_route;
  v_expires := coalesce(v_valid_until, now())
    + make_interval(mins => coalesce(v_typical, 60));

  v_token := encode(extensions.gen_random_bytes(16), 'hex');
  insert into public.ride_shares (ticket_id, rider_id, token, expires_at)
    values (p_ticket, v_uid, v_token, v_expires);

  return query select v_token, v_expires;
end;
$$;

revoke execute on function public.create_ride_share(uuid) from public, anon;
grant execute on function public.create_ride_share(uuid) to authenticated;

-- Kills a share immediately. Only the owning rider can.
create or replace function public.revoke_ride_share(p_share uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  update public.ride_shares
    set revoked_at = now()
    where id = p_share and rider_id = v_uid and revoked_at is null;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'no live share to revoke';
  end if;
end;
$$;

revoke execute on function public.revoke_ride_share(uuid) from public, anon;
grant execute on function public.revoke_ride_share(uuid) to authenticated;

-- The viewer's whole world: one row for a live token, nothing otherwise.
-- Deliberately excluded: who is riding, their phone, the board code, the
-- fare, the ticket id. Route and stop identifiers are public network data.
create or replace function public.ride_share_view(p_token text)
returns table (
  route_code text,
  route_name text,
  direction public.route_direction,
  from_stop_id uuid,
  from_stop_name text,
  to_stop_id uuid,
  to_stop_name text,
  trip_status text,
  share_expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.code,
    r.name,
    t.direction,
    t.from_stop_id,
    fs.name,
    t.to_stop_id,
    ts_.name,
    st.status::text,
    rs.expires_at
  from public.ride_shares rs
  join public.tickets t on t.id = rs.ticket_id
  join public.routes r on r.id = t.route_id
  left join public.stops fs on fs.id = t.from_stop_id
  left join public.stops ts_ on ts_.id = t.to_stop_id
  join public.ticket_status st on st.ticket_id = t.id
  where rs.token = p_token
    and rs.revoked_at is null
    and rs.expires_at > now()
    and st.status in ('issued', 'redeemed');
$$;

revoke execute on function public.ride_share_view(text) from public;
grant execute on function public.ride_share_view(text) to anon, authenticated;
