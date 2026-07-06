-- 0010 change to credit: enum value (applied first, on its own)
-- Postgres refuses to use a newly added enum value in the same transaction
-- that adds it, so 'change_credit' is added here as a standalone migration
-- before the functions in 0010_change_to_credit.sql use it.

alter type public.ledger_txn_kind add value if not exists 'change_credit';
