# Section 2: Technical design and product logic

*AI4I Challenge 2026, Track 3 Development. Draft for review. Page budget: 2 to 3 pages. Rubric anchors: C1 technical feasibility and code quality (30), C2 AI justification and fit (30).*

## System architecture

Svika is a monorepo of small, testable workspaces. Everything that touches money, tickets or rider identity lives behind Postgres row level security in a single Supabase project; every AI model runs server side in a separate spine service that never holds rider identity. Three surfaces sit in front of that: the rider web app, the conductor offline app, and the owner dashboard.

```
   RIDER (Next.js web)        CONDUCTOR (offline first PWA)      OWNER (dashboard)
   plan, board code,          fare clearing, board codes,       revenue, statement,
   wallet, share ride,        works offline in a moving          watchdog flags,
   Shona/English + voice      kombi, queued writes sync          ZIMRA tax card
        |                            |                                |
        |  phone OTP auth, role derived, session under RLS            |
        +-------------------+--------+----------------+---------------+
                            |                         |
                    SUPABASE (Postgres)        SPINE SERVICE (AI, server side)
                    - RLS on every table       - Spine 1 arrival prediction
                    - append only double       - Spine 2 commute alerts
                      entry ledger             - Spine 3 revenue watchdog
                    - event sourced tickets    every provider behind an
                    - consent records          adapter with a mock twin
                            |                         |
                    ZCHPC CCE (national compute): the spine service is a
                    plain container with locked manifests; see Section 3
```

Two rules shape the whole design. Data integrity is enforced in the database, not in the application, so a bug in a screen cannot print money or leak a ticket. AI is isolated in one service behind adapters, so a model can be swapped or a vendor can go dark without touching the ride path.

## The data spine: integrity that a judge can test

Row level security is on every table from the first migration. The service role key exists only in the seed script and CI secrets, never in a running app. An automated security test proves, using the anonymous key alone, that one rider cannot read another rider's tickets or wallet; that suite now stands at 97 checks passing, including rider isolation, ledger safety and consent scoping (`pnpm db:security-test`, evidenced in `docs/PHASE-C-GATE-REPORT.md`).

Money is a double entry, append only ledger. There are no mutable balance columns. Every movement is a pair of postings that must sum to zero, and unit tests prove money cannot be created, lost or double spent before any wallet feature merges (ledger invariant tests, 8 passing, 35 transactions balance in the phase 1 gate). Unreturned change becomes wallet credit through the same ledger, so it is a posting like any other, not a special case that could leak.

Tickets are event sourced. A ticket's life is a sequence of appended `ticket_events` rows, never an update over history. This is what lets the digital ticket act as the manifest the network has never had: the record of who boarded which vehicle on which route cannot be quietly rewritten after the fact.

Offline is architecture, not a feature. The conductor app holds a local ticket cache in IndexedDB and clears fares with no signal, in a moving kombi, in sunlight. Queued writes reconcile on the next sync with a first sync wins rule and conflicts flagged, and the offline settlement path is the same code as the online one, proven by a live database cycle test that settles once, replays as a no op, and credits change exactly once (34 checks passing, back to back, `docs/P2-GATE-REPORT.md`).

## The three AI spines

Svika uses AI in exactly three places, and nowhere else. Each spine keeps a named baseline and a committed metrics file, and each serves the model only when it beats that baseline on held out data. Where a rule or a query is enough, Svika uses the rule or the query and says so. This is a direct answer to the rubric's justification audit: no forced AI, no sledgehammer.

### Spine 1: arrival prediction with no timetable

The problem is real: the network has no schedule, so a rider cannot know when the next kombi arrives. The baseline is the naive per segment average. The model is a per segment, per hour average that can learn rush hour shape. The promotion rule is fixed in code: the model serves only when at least 10 journeys are recorded and it beats the baseline on a leave one journey out evaluation; serving code reads only the verdict in `metrics.json` (`services/spine/src/eta/train.ts`).

Today the honest verdict is that we do not yet have the data to promote a model, and the system says so on every estimate.

| Measure | Value |
| --- | --- |
| Recorded journeys | 2 |
| Segment observations | 20 |
| Baseline, per segment average | 96.4 s over 20 predictions |
| Model, per segment per hour | 96.4 s over 20 predictions |
| Verdict | insufficient_data |
| Served engine | baseline:v1 |

*Source: `services/spine/metrics/METRICS.md`, generated by `pnpm spine:train`. The promotion path itself is proven on a synthetic rush hour fixture in `test/eta-train.test.ts`, where the model wins and is promoted.*

Two rides is not enough to trust any model, the rule requires ten, so the baseline serves and every rendered arrival says how many rides it stands on. That is the design working as intended, not a shortfall to hide.

### Spine 2: commute alerts, deliberately not a model

A recurring trip is a counting problem, not a learning problem, so Spine 2 trains no model, and that is the point. A plain miner groups the rider's own tickets from the last 28 days and calls a stop pair a pattern when it has at least 5 rides over at least 3 distinct weekdays (`apps/web/src/lib/commute/patterns.ts`). The named baseline is the fixed alarm clock every commute app ships: "your 07:45 kombi". The alarm knows the rider's habit but cannot know today's supply. Svika fires the alert only when Spine 1 says a real vehicle is actually near, so on a day the kombis run early or run sparse, the alarm lies and the alert stays honest. A fixed alarm cannot know today's supply; that sentence is the whole justification for the design, and it is why this spine is statistics, not machine learning (`docs/SPINE-2-COMMUTE-ALERTS.md`).

### Spine 3: revenue anomaly detection

An owner cannot watch four kombis' takings by eye across months. The baseline is a fixed threshold, the "60 percent drop" rule an owner might set themselves. The model is an isolation forest over per route, per day features. The forest serves only while it beats the threshold on F1 over held out labelled days (`services/spine/src/watchdog/eval.ts`).

| Detector | Precision | Recall | F1 | TP | FP | FN |
| --- | --- | --- | --- | --- | --- | --- |
| Fixed threshold (named baseline, 60% drop) | never fired | 0.0% | 0 | 0 | 0 | 22 |
| Isolation forest, per route per day | 73.9% | 77.3% | 0.756 | 17 | 6 | 5 |

*Source: `services/spine/metrics/WATCHDOG-METRICS.md`, generated by `pnpm watchdog:eval`. Method: 10 synthetic replicates, 84 training days and 36 held out days each, 360 held out days total of which 22 carry injected leakage.*

The forest is promoted and serves. The threshold never fires because real leakage hides inside one kombi of four: a heavy skim on one vehicle moves the route total by well under the 40 percent drop the threshold needs. That dilution is the real world case, and it is exactly the argument for a model over a rule here. Every flag describes a pattern, a day, a route, an unnamed vehicle, never a person, and a unit test enforces that rule on the explanation templates.

## Honesty tiers, named on the record

Svika labels every feature by how real it is, in the README and in `docs/DISCLOSURE-REGISTER.md`. Tier 1 is real and working against the live database. Tier 2 is clickable with a fixed or simulated backend, always labelled on screen. Tier 3 lives in slides only and never in code. We never present a Tier 2 surface to a judge as if it were live. The three spines above are Tier 1: the detectors are real and their evaluations are real. Where they stand on generated history, Section 3 and the dataset statement say exactly what is real and what is simulated.
