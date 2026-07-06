# P1 gate report: core flows on the new spine

Status: PASSED (closed 2026-07-06). All eight P1 flows are built, unit tested,
committed, and now proven end to end against the live database. Migrations
0010 to 0013 are applied through the Supabase migration history, the full
Playwright suite is green, the RLS and ledger proofs pass, and the planner
answers every stop pair. Flow recordings are gathered in docs/p1-evidence.

The earlier INTERIM block was held open only because the Supabase MCP proxy
went down mid session and four migrations could not be applied. That is now
resolved; see "How the migrations were applied" below.

## What P1 delivered

Every money move is a balanced double entry ledger transaction, tickets
stay event sourced, RLS stayed intact, and clients still have no direct
write path into money or history.

1. The real planner: a graph over stops with dated fare segments, walking
   transfers and a boarding penalty. Every stop pair in the seeded network
   resolves; free text degrades to a stop picker, never a guess.
2. Search to plan to pay: wallet payment debits the ledger into escrow; cash
   reservation books a seat and moves no money until money really moves.
3. Board code to conductor redeem (online): 4 digit codes scoped to route,
   direction and time window; rate limited redemption with attempt logging.
4. Change to credit: unreturned change on a cash fare becomes wallet credit
   through the ledger, once per ticket, only by the conductor who cleared
   it, real USD note denominations only.
5. Split a note: one note covers several fares (payer covering companions);
   only the true remainder is credited.
6. Transfer and claim: credit parks in escrow under a 6 character claim
   code; claiming is rate limited with attempt logging; unclaimed credit
   cancels back to the sender.
7. Parcels: a ticket kind with LOAD and COLLECT codes; collect before load
   is refused; wallet parcels settle to the owner at collection; cash
   parcels take the note at load, where change to credit applies.
8. Owner ledger view: revenue per day and route derived from the ledger at
   read time; no counters, no cached totals; cash labelled as staying with
   the crew.

## Fares

2026 levels per the evidence base (post March 2026 fuel hike, $1.00 to
$2.00, ZimEye 7 Mar 2026 / Xinhua 13 Mar 2026): the Mhofu verified tier
structure shifted up one 50c note, dated in fare_segments effective
2026-03-07, flagged for replacement by P3 fieldwork fares. A stop pair
without a verified tier is charged the route end to end fare, never an
invented tier. No fare anywhere is outside the verified band, and the
database refuses implausible fares as data errors.

## How the migrations were applied

Postgres refuses to use a newly added enum value in the same transaction
that adds it. Migrations 0010, 0011 and 0012 each add values to an existing
enum and then use them, so each was split into an enum only step applied
first and a body step applied second. The migration ledger now reads, in
order: change_to_credit_enum, change_to_credit, credit_transfers_enums,
parcels_enums, credit_transfers, parcels_load_collect, owner_revenue_summary.
The repo mirror matches: the enum steps live in 0010_change_to_credit_enum.sql,
0011_credit_transfers_enums.sql and 0012_parcels_enums.sql, and the bodies
in the same numbered files without the enum lines. This keeps a clean rebuild
from disk reproducible. Types were regenerated after the apply.

## Gate proofs at close

### Planner answers every stop pair (unit, runs in CI)

```
✓ test/planner.test.ts (16 tests)
  ✓ answers every ordered stop pair in the network (the P1 gate)
    110 ordered pairs over the seeded 11 stop, 4 route network
Test Files  4 passed (4) · Tests  30 passed (30)
```

### Ledger invariants (live database)

```
PASS  I1 system wide posting sum is exactly zero
PASS  I2 all 35 transactions balance to zero
PASS  I2 no transaction is single sided
PASS  I3 no rider, conductor or owner wallet is negative
PASS  I4 service role cannot UPDATE a posting
PASS  I4 service role cannot DELETE a posting
PASS  I4 service role cannot rewrite a transaction
PASS  I5 appending an unbalancing posting is refused
8 passed, 0 failed
```

### RLS security suite (live database, anon key only)

```
37 passed, 0 failed, 0 skipped
```

Up from 29 at the interim: the 8 transfer isolation checks now execute since
migration 0011 is applied. They prove a rider cannot read another rider's
transfer, claim code, transfer events or claim attempts, cannot insert a
transfer directly, and cannot cancel a transfer they did not send.

### Playwright e2e (full suite, live database)

```
16 passed (2.3m)

book.spec.ts      5 passed
redeem.spec.ts    2 passed
change.spec.ts    2 passed
split.spec.ts     1 passed
transfer.spec.ts  2 passed
parcel.spec.ts    2 passed
owner.spec.ts     2 passed
```

Videos (video: on, 360px reference viewport) are gathered in
docs/p1-evidence/recordings, one canonical recording per flow, with the full
HTML report in docs/p1-evidence/report.

### Security advisors after the apply

The Supabase security advisor reports only the intended posture: every new
RPC is a security definer function callable by authenticated (this is the
whole write path, and each derives identity from auth.uid() and takes no role
or owner id from the client), plus the pre-existing auth leaked password
setting that does not apply to a phone OTP product. No new RLS gaps.

### Security review

A focused security review (security-review skill, subagent pass over the
full P1 diff and the new migrations) found no high confidence issues.
Verified strengths: every security definer RPC derives identity from
auth.uid() and takes no role or owner ids from the client; RLS scopes all
new tables (credit_transfers, transfer_events, transfer_claim_attempts,
fare_segments, transfer_points); redemption, claims and change credits are
serialised with advisory locks and re-checked under the lock; codes come
from gen_random_bytes; the e2e login endpoint 404s unless E2E_AUTH=on,
which only the local/CI Playwright config sets.

## Honesty register

- Tier 1 (real): planner, ledger, tickets, codes, redemption, change
  credit, transfers, parcels, owner revenue — all against the live
  database under RLS, all proven by the e2e suite above.
- Demo shims (labelled): e2e/rehearsal sign in uses seeded password
  accounts behind an env flag (E2E_AUTH=on). The flag is set only by the
  Playwright webServer config, never in a deploy; the product login stays
  phone OTP. Conductor commission is seeded at 0 until real rates come from
  fieldwork.
- Not in P1 by design: offline redemption (P2), live vehicle movement,
  EcoCash/InnBucks rails (adapters and mocks only, per the cut list).

## Known limits, logged for later phases

- Ride durations are route level typical minutes split per hop; learned
  per segment times arrive with P4 Spine 1.
- Parcels ride one kombi; a transfer parcel is refused with a clear
  message.
- Shona strings are careful best effort and need Mhofu's read before the
  demo; they are left untouched pending a trained dataset.

## Plain English summary

Everything P1 promised is built, committed, and now proven working end to
end. A rider can type where they are going in English or Shona, get a real
planned route with real 2026 fares, pay from their wallet or reserve and pay
cash, and board with a 4 digit code. The hwindi has his own app: pick the
route, type the code, and the screen goes full green when the fare clears.
If the rider paid cash with a big note, the hwindi taps which note it was and
how many people it covered, and the change goes straight into the rider's
wallet instead of staying with the kombi. Riders can send that credit to each
other with a short code. Parcels get two codes, one to put it on the kombi
and one to take it off. The owner sees exactly what digital money came in,
per day and per route, calculated from the money ledger itself.

The thing that did not finish last session is done: the last four database
changes are applied, the full test suite passed with screen recordings, the
security and money tests still pass (now stronger, with the transfer checks
live), and the planner still answers every stop pair. The gate is closed.
Still owed from you: a read of the Shona wording when you get a minute; it is
careful best effort, not a native speaker's.
