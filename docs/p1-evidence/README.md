# P1 evidence

Proof for the P1 gate close-out. All flows run against the live Supabase
project under RLS with the seeded demo users. Regenerate with
`pnpm test:e2e` from the repo root.

## Playwright e2e result

16 tests across 7 flows, all green (run 2026-07-06):

```
book.spec.ts      5 passed   wallet booking debits the ledger, cash reservation
                             moves no money, transfer plan with a walking leg,
                             free-text picker degrade, big board code shown
redeem.spec.ts    2 passed   valid code clears once then refused, wrong
                             direction code never clears
change.spec.ts    2 passed   unreturned change on a $5 note becomes wallet
                             credit via the ledger, wallet fare offers no change
split.spec.ts     1 passed   a $5 note covering two $2.00 fares credits $1.00
transfer.spec.ts  2 passed   send $1.00 and another rider claims it (money
                             conserved), wrong claim code pays nothing
parcel.spec.ts    2 passed   book, load, refuse early collect, then collect;
                             a transfer stop pair cannot book a parcel
owner.spec.ts     2 passed   a settled wallet fare lands in the owner revenue
                             view, a rider cannot open the owner view
```

Full HTML report: `report/index.html`.

## Flow recordings

The canonical happy-path recording for each of the seven flows, taken from the
Playwright run (video: on, 360px reference viewport). These back the proposal
and demo.

| file                                   | flow                                  |
| -------------------------------------- | ------------------------------------- |
| recordings/01-book-wallet-ticket.webm  | search, plan, pay from wallet         |
| recordings/02-redeem-board-code.webm   | conductor clears a board code once    |
| recordings/03-change-to-credit.webm    | change on a cash note becomes credit  |
| recordings/04-split-a-note.webm        | one note covering several fares       |
| recordings/05-transfer-and-claim.webm  | send credit, another rider claims it  |
| recordings/06-parcel-load-collect.webm | parcel LOAD then COLLECT codes        |
| recordings/07-owner-revenue-view.webm  | owner revenue derived from the ledger |

## Database proofs (live project, run 2026-07-06)

- RLS security suite: 37 passed, 0 failed (`pnpm db:security-test`) — includes
  the 8 transfer isolation checks that went live once 0011 applied.
- Ledger invariants: 8 passed, 0 failed (`pnpm db:ledger-test`) — 35
  transactions balance, system sum is zero, history is append only.
- Planner: every ordered stop pair in the seeded network resolves (16 unit
  tests, `pnpm test`).
