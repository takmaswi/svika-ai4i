-- 0011 credit transfers: ledger_txn_kind values (applied first, on their own)
-- Postgres refuses to use a newly added enum value in the same transaction
-- that adds it, so the transfer_* kinds are added here as a standalone
-- migration before the functions in 0011_credit_transfers.sql use them.

alter type public.ledger_txn_kind add value if not exists 'transfer_send';
alter type public.ledger_txn_kind add value if not exists 'transfer_claim';
alter type public.ledger_txn_kind add value if not exists 'transfer_cancel';
