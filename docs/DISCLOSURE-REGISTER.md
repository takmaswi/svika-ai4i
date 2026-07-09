# Svika demo disclosure register

What is real and what is staged, feature by feature. Tier 1 is real and
working against the live database. Tier 2 is clickable with a fixed or
simulated backend, always labelled on screen. Tier 3 lives in slides only and
never in code. We never present a Tier 2 surface as live to judges.

Last updated: 2026-07-09 (real arrival numbers milestone).

| Feature | Tier | What is actually happening |
| --- | --- | --- |
| Trip search, plan, fare quote | 1 | Real graph planner over the seeded network. Fares come from dated fare segments in Postgres. |
| Ticket purchase (wallet and cash) | 1 | Real double entry ledger. Money moves only through security definer RPCs, proven by ledger invariant tests. |
| Board codes and conductor redemption | 1 | Real 4 digit codes scoped to route, direction and time window, rate limited, attempts logged. |
| Offline conductor sync | 1 | Real IndexedDB cache and idempotent sync RPCs, proven against the live database. |
| Change to credit, split a note, transfers | 1 | Real ledger operations with RLS isolation tests. |
| Parcels (LOAD and COLLECT) | 1 | Real staged codes on the live database. |
| Owner revenue view | 1 | Real aggregation over ledger postings. |
| Live map: corridor geometry and stops | 1 | Real road line and 15 real stop names derived from field GPS rides on 2026-07-07 (packages/db/seed/geo). The warm map style is MapTiler tiles repainted to Brand v2. |
| Live map: moving kombis | 2 | Simulated. There is no GPS feed from vehicles yet. A mock VehicleFeed adapter moves markers along the real road at the speed the field ride measured (about 30 km/h). The map carries a permanent "Demo movement" chip. A real feed swaps in behind the same adapter without touching the map. |
| Saved trips (nickname a trip) | 1 | Real rider owned rows under RLS, proven by the security suite. |
| Arrival estimate on saved trips: the minutes | 1 | Computed by services/spine (GET /eta) from the two real corridor rides recorded 2026-07-07: per segment averages with a corridor average fallback (baseline:v1). The label under every estimate says how many recorded rides it stands on. With only two journeys the trained model is not promoted (services/spine/metrics/METRICS.md says so); when the spine is unreachable or a trip is off the corridor, the MockEtaProvider twin serves and the label says "demo estimate". |
| Arrival estimate on saved trips: the kombi position | 2 | Simulated. The minutes are measured from the same simulated kombi the live map shows (shared fixed epoch, sim-config.ts); there is still no GPS feed from real vehicles. A real feed swaps in behind the VehicleFeed adapter without touching the estimate. |
| Day and night theme | 1 | Real, cookie backed, follows the device by default. The map keeps its day style at night for now. |
| Voice guidance | 3 | Not in code yet. Pre generated audio lands in a later phase. |
| Spine 1 arrival prediction | 1 | Served baseline (per segment averages over real rides) with a committed evaluation: leave one journey out, model versus baseline, verdict in services/spine/metrics. The model is promoted only when it beats the baseline with at least 10 recorded journeys; today the verdict is insufficient data and the baseline serves. |
| Spine 2 commute alerts, Spine 3 revenue anomaly models | 3 | Not built yet. Their baselines and metrics tables arrive with their features. |

Update this file in the same commit as any feature that changes tier.
