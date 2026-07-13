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

Inference stays server side by product rule, a deliberate choice, not a gap: no model runs on a rider or conductor phone, which keeps riders' data off the device and on the ZCHPC national compute. The edge problem here is not model size on a handset, it is working when the network drops in a moving kombi, which Svika answers with the offline conductor app, not on device AI (Section 3). Section 5 carries the full edge and cost argument.

## The data spine: integrity that a judge can test

Row level security is on every table from the first migration. The service role key exists only in the seed script and CI secrets, never in a running app. An automated security test proves, using the anonymous key alone, that one rider cannot read another rider's tickets or wallet; that suite now stands at 102 checks passing, including rider isolation, ledger safety and consent scoping (`pnpm db:security-test`, all green in CI).

Money is a double entry, append only ledger. There are no mutable balance columns. Every movement is a pair of postings that must sum to zero, and unit tests prove money cannot be created, lost or double spent before any wallet feature merges (ledger invariant tests, 8 passing, 35 transactions balance in the phase 1 gate). Unreturned change becomes wallet credit through the same ledger, so it is a posting like any other, not a special case that could leak.

Tickets are event sourced. A ticket's life is a sequence of appended `ticket_events` rows, never an update over history. This is what lets the digital ticket act as the manifest the network has never had: the record of who boarded which vehicle on which route cannot be quietly rewritten after the fact.

Offline is architecture, not a feature. The conductor app holds a local ticket cache in IndexedDB and clears fares with no signal, in a moving kombi, in sunlight. Queued writes reconcile on the next sync with a first sync wins rule and conflicts flagged, and the offline settlement path is the same code as the online one, proven by a live database cycle test that settles once, replays as a no op, and credits change exactly once (34 checks passing, back to back, proven by the committed offline test suite).

## The three AI spines

Svika uses AI in exactly three places, and nowhere else. Each spine keeps a named baseline and a committed metrics file, and each serves the model only when it beats that baseline on held out data. Where a rule or a query is enough, Svika uses the rule or the query and says so. This is a direct answer to the rubric's justification audit: no forced AI, no sledgehammer.

### Spine 1: arrival prediction with no timetable

The problem is real: the network has no schedule, so a rider cannot know when the next kombi arrives. The baseline is the naive per segment average. The model is a per segment, per hour average that can learn rush hour shape. The promotion rule is fixed in code: the model serves only when at least 10 journeys are recorded and it beats the baseline on a leave one journey out evaluation; serving code reads only the verdict in `metrics.json` (`services/spine/src/eta/train.ts`).

The data comes from routine travel: a custom field GPS logger turns an everyday commute along the Mount Pleasant Heights to Rezende corridor, a route the team already rides, into structured, reproducible segment data, and the training pipeline ingests every new ride automatically. The model carries the discipline to defer to a transparent baseline until the data earns the switch. On two recorded journeys giving 20 segment observations, the baseline and the model tie at 96.4 seconds, below the ten journey bar, so the verdict is insufficient_data and baseline:v1 serves (`services/spine/metrics/METRICS.md`, generated by `pnpm spine:train`). The promotion path itself is proven on a synthetic rush hour fixture in `test/eta-train.test.ts`, where the model wins and is promoted.

| Spine 1 arrival, leave one journey out (route HEIGHTS-REZENDE, real field ride) | Value |
| --- | --- |
| Recorded journeys / segment observations | 2 / 20 |
| Baseline, per segment average | 96.4 s over 20 predictions |
| Model, per segment per hour average | 96.4 s over 20 predictions |
| Verdict / served engine | insufficient_data / baseline:v1 |

The corridor dataset grows with the team's routine travel, and the arrival model promotes itself automatically the moment it clears the bar. Every rendered arrival says how many rides it stands on, so the estimate is always honest about its own evidence.

### Spine 2: commute alerts, deliberately not a model

A recurring trip is a counting problem, not a learning problem, so Spine 2 trains no model, and that is the point. A plain miner groups the rider's own tickets from the last 28 days and calls a stop pair a pattern when it has at least 5 rides over at least 3 distinct weekdays (`apps/web/src/lib/commute/patterns.ts`). The named baseline is the fixed alarm clock every commute app ships: "your 07:45 kombi". The alarm knows the rider's habit but cannot know today's supply. Svika fires the alert only when Spine 1 says a real vehicle is actually near, so on a day the kombis run early or run sparse, the alarm lies and the alert stays honest. A fixed alarm cannot know today's supply; that sentence is the whole justification for the design, and it is why this spine is statistics, not machine learning.

### Spine 3: revenue anomaly detection

An owner cannot watch four kombis' takings by eye across months. The baseline is a fixed threshold, the "60 percent drop" rule an owner might set themselves. The model is an isolation forest over per route, per day features. The forest serves only while it beats the threshold on F1 over held out labelled days (`services/spine/src/watchdog/eval.ts`). Over 360 held out days, of which 22 carry injected leakage, the forest scores an F1 of 0.756 at 73.9 percent precision and 77.3 percent recall, while the fixed threshold never fires and scores zero (`services/spine/metrics/WATCHDOG-METRICS.md`, generated by `pnpm watchdog:eval`).

The forest is promoted and serves. The threshold never fires because real leakage hides inside one kombi of four: a heavy skim on one vehicle moves the route total by well under the 40 percent drop the threshold needs. That dilution is the real world case, and it is exactly the argument for a model over a rule here. Every flag describes a pattern, a day, a route, an unnamed vehicle, never a person, and a unit test enforces that rule on the explanation templates.

| Spine 3 watchdog, 360 held out days, 22 with injected leakage | Precision | Recall | F1 |
| --- | --- | --- | --- |
| Fixed threshold, 60% drop rule (never fired) | 0.0% | 0.0% | 0 |
| Isolation forest, per route per day features | 73.9% | 77.3% | 0.756 |

## Honesty tiers, named on the record

Svika labels every feature by how real it is, in the README and a committed disclosure register, on the tier scale Section 4 defines. The three spines above are Tier 1: the detectors are real and their evaluations are real. Where they stand on generated history, Section 3 and the dataset statement say exactly what is real and what is simulated.
