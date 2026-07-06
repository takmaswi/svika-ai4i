-- 0004 event sourced tickets and board codes v2
-- A ticket row is the immutable purchase fact. All state lives in
-- ticket_events, which is append only; current status is the latest event
-- (ticket_status view). Nothing in the ticket path is ever UPDATEd.
--
-- Board codes v2: 4 digits, scoped to route + direction + validity window
-- (uniqueness enforced by an exclusion constraint over that scope), redeemed
-- through a rate limited RPC that logs every attempt.
--
-- All writes go through security definer RPCs (purchase_ticket,
-- redeem_board_code); clients have no direct write path.
-- RLS is enabled on every table in this migration, in this migration.

create type public.ticket_event_type as enum (
  'issued',
  'redeemed',
  'cancelled',
  'expired',
  'refunded'
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete restrict,
  route_id uuid not null references public.routes (id) on delete restrict,
  direction public.route_direction not null,
  fare_cents integer not null check (fare_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  purchased_at timestamptz not null default now()
);

create index tickets_rider_idx on public.tickets (rider_id);
create index tickets_route_idx on public.tickets (route_id);

alter table public.tickets enable row level security;

create policy "tickets select own"
  on public.tickets for select
  to authenticated
  using (rider_id = (select auth.uid()));

-- purchase facts are immutable; status lives in events
create trigger tickets_append_only
  before update or delete on public.tickets
  for each row execute function public.forbid_mutation();

create table public.ticket_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets (id) on delete restrict,
  event_type public.ticket_event_type not null,
  actor_profile_id uuid references public.profiles (id),
  conductor_id uuid references public.conductors (id),
  vehicle_id uuid references public.vehicles (id),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ticket_events_ticket_idx on public.ticket_events (ticket_id, created_at desc);

alter table public.ticket_events enable row level security;

create policy "ticket_events select own tickets"
  on public.ticket_events for select
  to authenticated
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.rider_id = (select auth.uid())
    )
  );

create trigger ticket_events_append_only
  before update or delete on public.ticket_events
  for each row execute function public.forbid_mutation();

-- current status = latest event
create view public.ticket_status
with (security_invoker = on) as
select distinct on (t.id)
  t.id as ticket_id,
  t.rider_id,
  t.route_id,
  t.direction,
  t.fare_cents,
  e.event_type as status,
  e.created_at as status_at
from public.tickets t
join public.ticket_events e on e.ticket_id = t.id
order by t.id, e.created_at desc, e.id desc;

create table public.board_codes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.tickets (id) on delete restrict,
  route_id uuid not null references public.routes (id) on delete restrict,
  direction public.route_direction not null,
  code text not null check (code ~ '^[0-9]{4}$'),
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  check (valid_until > valid_from),
  -- v2 scoping: a code is unique within route + direction + overlapping window
  constraint board_codes_scope_excl exclude using gist (
    route_id with =,
    direction with =,
    code with =,
    tstzrange(valid_from, valid_until) with &&
  )
);

alter table public.board_codes enable row level security;

create policy "board_codes select own tickets"
  on public.board_codes for select
  to authenticated
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.rider_id = (select auth.uid())
    )
  );

create trigger board_codes_append_only
  before update or delete on public.board_codes
  for each row execute function public.forbid_mutation();

-- every redemption attempt is logged, success or not; the rate limiter
-- reads this table
create table public.code_redemption_attempts (
  id bigint generated always as identity primary key,
  conductor_id uuid not null references public.conductors (id) on delete restrict,
  route_id uuid references public.routes (id),
  direction public.route_direction,
  code_entered text not null,
  outcome text not null check (
    outcome in ('success', 'invalid_code', 'already_redeemed', 'rate_limited')
  ),
  ticket_id uuid references public.tickets (id),
  attempted_at timestamptz not null default now()
);

create index code_redemption_attempts_rate_idx
  on public.code_redemption_attempts (conductor_id, attempted_at desc);

alter table public.code_redemption_attempts enable row level security;

create policy "redemption attempts select own"
  on public.code_redemption_attempts for select
  to authenticated
  using (
    conductor_id in (
      select id from public.conductors
      where profile_id = (select auth.uid())
    )
  );

create trigger code_redemption_attempts_append_only
  before update or delete on public.code_redemption_attempts
  for each row execute function public.forbid_mutation();

-- ledger transactions can now reference tickets
alter table public.ledger_transactions
  add constraint ledger_transactions_ticket_fk
  foreign key (ticket_id) references public.tickets (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- purchase_ticket: the rider write path.
-- Debits the rider wallet into platform escrow, creates the ticket, appends
-- the 'issued' event and allocates a board code. p_valid_minutes is an
-- engineering default (2h), tunable per product decision.
-- ---------------------------------------------------------------------------
create or replace function public.purchase_ticket(
  p_route uuid,
  p_direction public.route_direction,
  p_valid_minutes integer default 120
)
returns table (ticket_id uuid, board_code text, fare_cents integer, valid_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider uuid := (select auth.uid());
  v_fare integer;
  v_wallet uuid;
  v_escrow uuid;
  v_balance bigint;
  v_ticket uuid;
  v_txn uuid;
  v_code text;
  v_bytes bytea;
  v_valid_until timestamptz;
  v_tries integer := 0;
begin
  if v_rider is null then
    raise exception 'not authenticated';
  end if;
  if p_valid_minutes < 15 or p_valid_minutes > 1440 then
    raise exception 'validity window out of range';
  end if;

  perform 1 from public.routes r where r.id = p_route and r.active;
  if not found then
    raise exception 'unknown or inactive route';
  end if;

  v_fare := public.current_fare_cents(p_route);
  if v_fare is null then
    raise exception 'no fare configured for this route';
  end if;

  select id into v_wallet
  from public.ledger_accounts
  where profile_id = v_rider and kind = 'rider_wallet';
  if v_wallet is null then
    raise exception 'no rider wallet';
  end if;

  select id into v_escrow
  from public.ledger_accounts
  where kind = 'platform_escrow' and profile_id is null;

  -- serialise balance check and debit per wallet
  perform pg_advisory_xact_lock(hashtextextended(v_wallet::text, 42));

  select coalesce(sum(amount_cents), 0) into v_balance
  from public.ledger_postings
  where account_id = v_wallet;
  if v_balance < v_fare then
    raise exception 'insufficient wallet balance';
  end if;

  insert into public.tickets (rider_id, route_id, direction, fare_cents)
  values (v_rider, p_route, p_direction, v_fare)
  returning id into v_ticket;

  insert into public.ticket_events (ticket_id, event_type, actor_profile_id)
  values (v_ticket, 'issued', v_rider);

  insert into public.ledger_transactions (kind, ticket_id, memo, created_by)
  values ('ticket_purchase', v_ticket, 'ticket purchase', v_rider)
  returning id into v_txn;

  insert into public.ledger_postings (transaction_id, account_id, amount_cents)
  values
    (v_txn, v_wallet, -v_fare),
    (v_txn, v_escrow, v_fare);

  v_valid_until := now() + make_interval(mins => p_valid_minutes);

  loop
    v_bytes := extensions.gen_random_bytes(2);
    v_code := lpad((((get_byte(v_bytes, 0) << 8) | get_byte(v_bytes, 1)) % 10000)::text, 4, '0');
    begin
      insert into public.board_codes (ticket_id, route_id, direction, code, valid_until)
      values (v_ticket, p_route, p_direction, v_code, v_valid_until);
      exit;
    exception when exclusion_violation then
      v_tries := v_tries + 1;
      if v_tries >= 25 then
        raise exception 'could not allocate a board code, try again';
      end if;
    end;
  end loop;

  return query select v_ticket, v_code, v_fare, v_valid_until;
end;
$$;

revoke execute on function public.purchase_ticket(uuid, public.route_direction, integer) from public, anon;
grant execute on function public.purchase_ticket(uuid, public.route_direction, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- redeem_board_code: the conductor write path.
-- Rate limited (5 failed attempts per 10 minutes), every attempt logged.
-- On success: appends the 'redeemed' event and settles escrow into the
-- owner wallet and conductor commission. Failures return outcome strings
-- (not exceptions) so the attempt log always commits.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_board_code(
  p_route uuid,
  p_direction public.route_direction,
  p_code text,
  p_vehicle uuid default null
)
returns table (outcome text, ticket_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_conductor public.conductors%rowtype;
  v_bc public.board_codes%rowtype;
  v_failures integer;
  v_status public.ticket_event_type;
  v_fare bigint;
  v_commission bigint;
  v_owner_amount bigint;
  v_owner_wallet uuid;
  v_conductor_wallet uuid;
  v_escrow uuid;
  v_txn uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_conductor
  from public.conductors c
  where c.profile_id = v_uid and c.active;
  if not found then
    raise exception 'not an active conductor';
  end if;

  if p_vehicle is not null then
    perform 1 from public.vehicles v
    where v.id = p_vehicle and v.owner_id = v_conductor.owner_id;
    if not found then
      raise exception 'vehicle does not belong to your fleet';
    end if;
  end if;

  -- rate limit: at most 5 failed attempts in the last 10 minutes
  select count(*) into v_failures
  from public.code_redemption_attempts a
  where a.conductor_id = v_conductor.id
    and a.outcome <> 'success'
    and a.attempted_at > now() - interval '10 minutes';
  if v_failures >= 5 then
    insert into public.code_redemption_attempts (conductor_id, route_id, direction, code_entered, outcome)
    values (v_conductor.id, p_route, p_direction, p_code, 'rate_limited');
    return query select 'rate_limited'::text, null::uuid;
    return;
  end if;

  select * into v_bc
  from public.board_codes b
  where b.route_id = p_route
    and b.direction = p_direction
    and b.code = p_code
    and b.valid_from <= now()
    and b.valid_until > now();
  if not found then
    -- expired and never-existed look identical on purpose (no oracle)
    insert into public.code_redemption_attempts (conductor_id, route_id, direction, code_entered, outcome)
    values (v_conductor.id, p_route, p_direction, p_code, 'invalid_code');
    return query select 'invalid_code'::text, null::uuid;
    return;
  end if;

  -- serialise per ticket, then re-check status under the lock
  perform pg_advisory_xact_lock(hashtextextended(v_bc.ticket_id::text, 7));

  select e.event_type into v_status
  from public.ticket_events e
  where e.ticket_id = v_bc.ticket_id
  order by e.created_at desc, e.id desc
  limit 1;
  if v_status is distinct from 'issued' then
    insert into public.code_redemption_attempts (conductor_id, route_id, direction, code_entered, outcome, ticket_id)
    values (v_conductor.id, p_route, p_direction, p_code, 'already_redeemed', v_bc.ticket_id);
    return query select 'already_redeemed'::text, v_bc.ticket_id;
    return;
  end if;

  select t.fare_cents into v_fare from public.tickets t where t.id = v_bc.ticket_id;
  v_commission := (v_fare * v_conductor.commission_rate_bps) / 10000;
  v_owner_amount := v_fare - v_commission;

  select id into v_escrow
  from public.ledger_accounts
  where kind = 'platform_escrow' and profile_id is null;

  select a.id into v_owner_wallet
  from public.ledger_accounts a
  join public.owners o on o.profile_id = a.profile_id
  where o.id = v_conductor.owner_id and a.kind = 'owner_wallet';
  if v_owner_wallet is null then
    insert into public.ledger_accounts (kind, profile_id)
    select 'owner_wallet', o.profile_id from public.owners o where o.id = v_conductor.owner_id
    returning id into v_owner_wallet;
  end if;

  if v_commission > 0 then
    select id into v_conductor_wallet
    from public.ledger_accounts
    where profile_id = v_uid and kind = 'conductor_wallet';
    if v_conductor_wallet is null then
      insert into public.ledger_accounts (kind, profile_id)
      values ('conductor_wallet', v_uid)
      returning id into v_conductor_wallet;
    end if;
  end if;

  insert into public.ledger_transactions (kind, ticket_id, memo, created_by)
  values ('fare_settlement', v_bc.ticket_id, 'fare settlement on redemption', v_uid)
  returning id into v_txn;

  insert into public.ledger_postings (transaction_id, account_id, amount_cents)
  values (v_txn, v_escrow, -v_fare), (v_txn, v_owner_wallet, v_owner_amount);
  if v_commission > 0 then
    insert into public.ledger_postings (transaction_id, account_id, amount_cents)
    values (v_txn, v_conductor_wallet, v_commission);
  end if;

  insert into public.ticket_events (ticket_id, event_type, actor_profile_id, conductor_id, vehicle_id)
  values (v_bc.ticket_id, 'redeemed', v_uid, v_conductor.id, p_vehicle);

  insert into public.code_redemption_attempts (conductor_id, route_id, direction, code_entered, outcome, ticket_id)
  values (v_conductor.id, p_route, p_direction, p_code, 'success', v_bc.ticket_id);

  return query select 'success'::text, v_bc.ticket_id;
end;
$$;

revoke execute on function public.redeem_board_code(uuid, public.route_direction, text, uuid) from public, anon;
grant execute on function public.redeem_board_code(uuid, public.route_direction, text, uuid) to authenticated;

-- clients never write ticket state directly
revoke insert, update, delete on table public.tickets, public.ticket_events, public.board_codes, public.code_redemption_attempts from authenticated, anon;
