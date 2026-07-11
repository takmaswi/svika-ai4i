-- 0028 demo solo float
-- The named story personas (Takunda, Rudo) live outside the judge pool, so
-- demo_reset_mine refuses them. This is their float: the same double entry
-- adjustment against external_cash, for the caller only, demo_sim only,
-- and never above $10. Rudo's story starts at zero (her wallet was stolen),
-- Takunda's at $5.
create or replace function public.demo_float_mine(p_target_cents integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_demo boolean;
  v_wallet uuid;
  v_balance bigint;
  v_diff bigint;
  v_cash uuid;
  v_txn uuid;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  select demo_sim into v_demo from public.profiles where id = v_uid;
  if v_demo is distinct from true then
    raise exception 'demo floats are for demo profiles only';
  end if;
  if p_target_cents is null or p_target_cents < 0 or p_target_cents > 1000 then
    raise exception 'float target out of range';
  end if;

  select id into v_wallet
  from public.ledger_accounts
  where profile_id = v_uid and kind = 'rider_wallet';
  if v_wallet is null then
    raise exception 'no wallet';
  end if;
  select coalesce(sum(amount_cents), 0) into v_balance
  from public.ledger_postings where account_id = v_wallet;
  v_diff := p_target_cents - v_balance;
  if v_diff <> 0 then
    select id into v_cash
    from public.ledger_accounts
    where kind = 'external_cash' and profile_id is null;
    insert into public.ledger_transactions (kind, memo, created_by)
    values ('adjustment', 'demo story float', v_uid)
    returning id into v_txn;
    insert into public.ledger_postings (transaction_id, account_id, amount_cents)
    values (v_txn, v_wallet, v_diff), (v_txn, v_cash, -v_diff);
  end if;
end;
$$;

revoke execute on function public.demo_float_mine(integer) from public, anon;
grant execute on function public.demo_float_mine(integer) to authenticated;
