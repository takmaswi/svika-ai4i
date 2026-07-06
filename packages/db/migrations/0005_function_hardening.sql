-- 0005 function hardening (from the Supabase security advisor run)
-- 1. forbid_mutation had a role mutable search_path.
-- 2. Internal trigger and helper functions were REST callable because
--    Postgres grants EXECUTE to public by default. Trigger functions never
--    need caller EXECUTE; policy helpers need EXECUTE only for
--    authenticated (policies run as the querying role).
-- purchase_ticket and redeem_board_code stay callable by authenticated on
-- purpose: they are the only write paths and are flagged as intentional.

create or replace function public.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
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

-- trigger functions: no direct execution by anyone over REST
revoke execute on function public.forbid_mutation() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_profile() from public, anon, authenticated;
revoke execute on function public.assert_transaction_balanced() from public, anon, authenticated;

-- policy helpers: needed by authenticated (RLS policies run as the caller),
-- pointless for anon
revoke execute on function public.current_owner_id() from public, anon;
revoke execute on function public.is_party_to_transaction(uuid) from public, anon;

-- read helper used by the planner and purchase path; harmless but anon has
-- no reason to call it directly
revoke execute on function public.current_fare_cents(uuid) from public, anon;
