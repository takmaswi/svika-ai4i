# P0 gate report: database slice

Date: 6 July 2026. Scope: Supabase foundation only (project, schema, RLS,
ledger, event sourced tickets, security test, types, env).

## Project

Ref `xbsawnsdvibarhjobvrm` at https://xbsawnsdvibarhjobvrm.supabase.co,
region eu-west-2 (London). Supabase offers no African region; Zimbabwe's
international routes and Liquid's main peering concentrate in London, so
eu-west-2 gives the lowest consistent RTT from Harare of the options.
Postgres 17. `pms-microfinance` was paused (Mhofu's choice) to free the
second free plan slot; it can be restored from the dashboard any time.

## Migrations applied (mirrored in packages/db/migrations)

| version        | name                    |
| -------------- | ----------------------- |
| 20260706070439 | identity_and_fleet      |
| 20260706070504 | transit_network         |
| 20260706070547 | wallet_ledger           |
| 20260706070643 | tickets_and_board_codes |
| 20260706071414 | function_hardening      |

Non negotiables honoured: RLS enabled on every table in the migration that
creates it; money is a double entry append only ledger with no balance
columns (two or more postings per transaction summing to zero, enforced by a
deferred constraint trigger; wallets cannot go negative); tickets are event
sourced (immutable ticket row, append only ticket_events, status is a view);
board codes v2 are 4 digits scoped by exclusion constraint to route +
direction + time window with rate limited, fully logged redemption; the only
client write paths are the purchase_ticket and redeem_board_code RPCs.

## RLS security test output (pnpm db:security-test, anon key only)

```
PASS  anon can read the public route network
PASS  anon sees zero tickets
PASS  anon sees zero ledger accounts
PASS  rider A can purchase a ticket via RPC
PASS  rider B can purchase a ticket via RPC
PASS  purchase debits exactly the fare from A's wallet (ledger derived)
PASS  rider A sees only own tickets
PASS  rider A cannot read rider B's ticket by id
PASS  rider A cannot read rider B's ticket events
PASS  rider A sees only own board codes
PASS  rider A cannot read rider B's board code
PASS  rider A cannot read rider B's wallet account
PASS  rider A cannot read rider B's wallet postings
PASS  rider A cannot read rider B's balance
PASS  rider A's account list is only their own
PASS  rider A sees only transactions they are party to
PASS  rider cannot UPDATE a ticket
PASS  rider cannot DELETE ticket history
PASS  rider cannot INSERT ledger postings (no money printing)
PASS  rider cannot forge ticket events
PASS  rider cannot call the service only topup function
PASS  rider A cannot edit rider B's profile
PASS  conductor cannot browse tickets
PASS  conductor cannot harvest board codes
PASS  conductor can redeem a valid board code
PASS  same code cannot be redeemed twice
PASS  code is scoped: wrong direction does not redeem
PASS  rider A sees own ticket as redeemed (event sourced status)
PASS  rider cannot read the redemption attempt log

29 passed, 0 failed, 0 skipped
```

Ledger cross check after the run: system wide posting sum is exactly 0;
the redeemed fare split escrow into owner 90 and conductor 10 (synthetic 10
percent test commission); the unredeemed fare sits in escrow.

## Security advisor status

Actionable findings fixed in migration 0005 (search_path pin, execute
revocations on internal functions). Remaining warnings are intentional and
documented: purchase_ticket and redeem_board_code are the product's write
API; the two policy helper functions must stay executable by signed in users
because RLS policies run as the caller, and they only reveal the caller's own
data. One dashboard item for Mhofu: enable leaked password protection under
Auth settings (not reachable through the management tooling used here).

## Honesty and data notes

TEST-01 and its stops are synthetic fixtures, labelled as such; no Harare
geography or fares were invented. The real network seed waits on corridor
data. The service role key is not stored anywhere yet (the management tooling
cannot read it); paste it into .env.local from the dashboard when the seed
script lands. Board code entropy is 4 digits by design (10,000 per route,
direction and window) and relies on scoping plus rate limiting, not secrecy.

## Known limits logged for later phases

Refund, cancel and expiry RPCs are schema ready (event types exist) but not
implemented. Owner revenue visibility surfaces (aggregate views) come with
the owner dashboard phase. Payout paths (wallet to cash out) are adapter
work, mock only per product law. CI wiring for typecheck, lint, test and the
security test is still owed in P0 and blocked on repo access with workflow
scope.
