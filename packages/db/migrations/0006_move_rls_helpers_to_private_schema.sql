-- 0006 advisor cleanup: move internal RLS helpers out of the REST-exposed schema.
--
-- Advisor `authenticated_security_definer_function_executable` flagged four
-- SECURITY DEFINER functions callable by `authenticated`:
--   current_owner_id(), is_party_to_transaction(), purchase_ticket(),
--   redeem_board_code().
--
-- current_owner_id() and is_party_to_transaction() are called only inside RLS
-- policy expressions. They must stay SECURITY DEFINER (they exist precisely to
-- bypass RLS on the lookup tables and avoid policy recursion, see 0001 and
-- 0003), and the invoking `authenticated` role MUST retain EXECUTE on them or
-- the policies error out (proven: revoking EXECUTE broke the ledger_transactions
-- and would break the owner fleet policies). So a plain revoke is not an option.
--
-- The safe remediation (per the advisor's own guidance) is to move them out of
-- the API-exposed `public` schema. PostgREST exposes only public + graphql_public,
-- so functions in `private` are unreachable via /rest/v1/rpc/*: the advisor stops
-- flagging them, while RLS keeps working because `authenticated` still holds
-- USAGE on the schema and EXECUTE on the functions.
--
-- purchase_ticket() and redeem_board_code() deliberately stay in public and
-- REST-callable: they are the only client write path. Both derive the actor from
-- auth.uid() and raise 'not authenticated' when it is null, so a caller can only
-- ever act as themselves. Their two advisor warnings are intentional; wrapping
-- them just to silence the linter would add indirection without adding security.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- recreate the helpers in private, bodies unchanged
create or replace function private.current_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.owners where profile_id = auth.uid();
$$;

create or replace function private.is_party_to_transaction(p_txn uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ledger_postings p
    join public.ledger_accounts a on a.id = p.account_id
    where p.transaction_id = p_txn
      and a.profile_id = auth.uid()
  );
$$;

-- private helpers: RLS needs authenticated to execute them; nobody else should
revoke execute on function private.current_owner_id() from public;
revoke execute on function private.is_party_to_transaction(uuid) from public;
grant execute on function private.current_owner_id() to authenticated, service_role;
grant execute on function private.is_party_to_transaction(uuid) to authenticated, service_role;

-- repoint every policy that referenced the public helpers
drop policy "conductors select own or fleet" on public.conductors;
create policy "conductors select own or fleet"
  on public.conductors for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or owner_id = (select private.current_owner_id())
  );

drop policy "vehicles select own fleet" on public.vehicles;
create policy "vehicles select own fleet"
  on public.vehicles for select
  to authenticated
  using (owner_id = (select private.current_owner_id()));

drop policy "ledger_transactions select party" on public.ledger_transactions;
create policy "ledger_transactions select party"
  on public.ledger_transactions for select
  to authenticated
  using (private.is_party_to_transaction(id));

-- nothing references the public helpers now; drop them
drop function public.current_owner_id();
drop function public.is_party_to_transaction(uuid);
