-- 0012 parcels: ticket_event_type values (applied first, on their own)
-- Postgres refuses to use a newly added enum value in the same transaction
-- that adds it, so 'loaded' and 'collected' are added here as a standalone
-- migration before the stage aware redeem in 0012_parcels_load_collect.sql
-- uses them.

alter type public.ticket_event_type add value if not exists 'loaded';
alter type public.ticket_event_type add value if not exists 'collected';
