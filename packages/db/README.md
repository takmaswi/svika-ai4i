# @svika/db

Migrations, RLS security tests and generated types for the Svika database
(Supabase project `xbsawnsdvibarhjobvrm`, eu-west-2).

## Design in one paragraph

Every profile is a rider; conductors and owners are role extension tables.
Money is a double entry, append only ledger: no balance columns anywhere, a
balance is `sum(postings)`, every transaction must have two or more postings
summing to zero (enforced by a deferred constraint trigger), and wallets can
never go negative. Tickets are event sourced: the ticket row is the immutable
purchase fact, all state is appended to `ticket_events`, and current status is
a view over the latest event. Board codes are 4 digits scoped to route,
direction and time window (exclusion constraint), redeemed only through a rate
limited RPC that logs every attempt. Clients have no direct write path into
money or history; the only write paths are `purchase_ticket` and
`redeem_board_code`, both security definer RPCs.

## Migrations

Applied in order through the Supabase migration history, mirrored here in
`migrations/`. RLS is enabled on every table in the same migration that
creates it. Append only tables carry a `forbid_mutation` trigger that stops
UPDATE and DELETE even for the service role.

| file | contents |
| --- | --- |
| 0001_identity_and_fleet.sql | profiles, owners, conductors, vehicles, signup trigger |
| 0002_transit_network.sql | routes, stops, route_stops, append only route_fares |
| 0003_wallet_ledger.sql | accounts, transactions, postings, invariants, balances view |
| 0004_tickets_and_board_codes.sql | tickets, ticket_events, board_codes, attempts, RPCs |
| 0005_function_hardening.sql | advisor fixes: search_path pin, execute revocations |

## Security test

```
pnpm db:security-test
```

Runs `test/rls.security.test.mjs` against the live project using only the
anon key (what an attacker has). It proves rider isolation (tickets, events,
board codes, wallet accounts, postings, balances), that anonymous users see
nothing private, that no client can print money, forge events or rewrite
history, and that redemption is scoped and single use. Test credentials come
from `.env.local` (see `.env.example`); the synthetic test users and TEST-01
route are provisioned server side.

Note: the real Harare network is seeded from corridor fieldwork, never
invented. TEST-01 is synthetic and labelled as such.
