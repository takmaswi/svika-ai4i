-- 0013 owner revenue summary
-- The owner's view of real money: fare settlements aggregated per day and
-- route straight from the ledger (no counters, no cached totals). Only the
-- calling owner's settlements are visible; the function derives the owner
-- from auth.uid() and never takes an owner id from the client.

create or replace function public.owner_revenue_summary()
returns table (
  day date,
  route_code text,
  route_name text,
  tickets bigint,
  gross_cents bigint,
  commission_cents bigint,
  net_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_wallet uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  perform 1 from public.owners o where o.profile_id = v_uid;
  if not found then
    raise exception 'not an owner';
  end if;

  select a.id into v_wallet
  from public.ledger_accounts a
  where a.profile_id = v_uid and a.kind = 'owner_wallet';
  if v_wallet is null then
    return; -- no settlements yet
  end if;

  return query
  select
    (t.created_at at time zone 'Africa/Harare')::date as day,
    r.code as route_code,
    r.name as route_name,
    count(*)::bigint as tickets,
    sum(tk.fare_cents)::bigint as gross_cents,
    (sum(tk.fare_cents) - sum(p.amount_cents))::bigint as commission_cents,
    sum(p.amount_cents)::bigint as net_cents
  from public.ledger_transactions t
  join public.ledger_postings p
    on p.transaction_id = t.id and p.account_id = v_wallet
  join public.tickets tk on tk.id = t.ticket_id
  join public.routes r on r.id = tk.route_id
  where t.kind = 'fare_settlement'
  group by 1, 2, 3
  order by 1 desc, 2;
end;
$$;

revoke execute on function public.owner_revenue_summary() from public, anon;
grant execute on function public.owner_revenue_summary() to authenticated;
