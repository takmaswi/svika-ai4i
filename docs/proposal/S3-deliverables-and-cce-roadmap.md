# Section 3: Deliverables and CCE implementation roadmap

*AI4I Challenge 2026, Track 3 Development. Draft for review. Page budget: 2 pages. Rubric anchors: C1 code quality and locked manifests (30), C4 feasibility (20).*

## What is already built

Svika is not a concept. It is a working monorepo with a live database, passing tests and recorded demo evidence. The following are Tier 1, real and running against the live Supabase project, unless marked otherwise.

- **Identity and access.** Phone OTP sign in, roles derived from the network, sessions enforced under row level security. Consent gate on every surface before any personal data is touched, with an append only consent record and a plain language privacy notice.
- **The money and ticket core.** Append only double entry ledger, event sourced tickets, dated fare segments seeded at verified 2026 fares, a graph trip planner with transfer penalties proven over every stop pair, cash reservation and fare plausibility guards. Change becomes wallet credit through the ledger. Credit transfers, parcels and the owner ledger view are built and tested (phase 1 gate, 16 end to end tests, ledger 8 of 8).
- **The rider surface.** Search, plan and pay across Harare in Shona and English, a boarding card with a redemption stamp, the wallet, saved trips, share my ride as a tokenised live link, and commute alerts wired to the live arrival predictor.
- **The conductor surface.** An offline first installable app that clears fares with no signal, holds a local ticket cache, and reconciles queued writes on sync with first sync wins. Board codes are four digits, scoped to route, direction and time window, rate limited with attempt logging.
- **The live map and real data.** A MapLibre live map over the real Mount Pleasant Heights to Rezende corridor, seeded from the corridor rides the team records with a custom field GPS logger that turns routine travel into structured data. Arrival numbers are served by the real spine over real segment times, every estimate labelled with how many rides it stands on.
- **The AI spines.** All three built and evaluated with committed metrics: arrival prediction (baseline serving, promotion path proven on a fixture), commute alerts (statistics, live), revenue watchdog (isolation forest promoted, F1 0.756 against a threshold that never fires). See Section 2.
- **The owner surface.** Revenue dashboard, printable statement, the bilingual watchdog narrative, and the dated ZIMRA presumptive tax card. Watchdog history is labelled simulated on screen and in the register.
- **Staged, clearly labelled Tier 2 work.** A USSD menu state machine and a rendered feature phone for the no smartphone rider, and a staged crash alert flow. These are built behind tested state machines but move no real money and call no live telco; each carries an on screen caption saying so, and each awaits a partner agreement.

Discipline is visible in the history. Commits are small and conventional, the lockfile is committed, dependencies are pinned, and continuous integration runs typecheck, lint and test on every push. Current validation stands at 287 unit tests across the workspace, 56 full web end to end tests, and the 102 check security suite, all green, with the ledger invariants at 8 of 8 and the offline cycle at 34 of 34, all green in CI.

Every claim above is committed and inspectable. The code, migrations, tests, metrics and full commit history live in the public repository at github.com/takmaswi/svika-ai4i, and the product runs live at svika-web.vercel.app. A reviewer opens it through the Enter the demo button on the home page with no sign up, because phone sign in stays limited to registered test numbers during the pilot.

## Compute requirements

The three models are deliberately light: an isolation forest and a pair of averaging predictors, CPU only, no GPU, no large weights, server side by product rule. That keeps the compute footprint small enough for a modest national compute allocation and removes the edge memory and latency risk heavier designs carry.

## Deploying and testing in the ZCHPC CCE

The architecture was chosen with the national compute in mind. The spine service is a stateless container with a locked manifest; it takes ticket and ride data in and returns predictions and flags, holding no rider identity. That makes it a clean fit for the ZCHPC Cognitive Computing Environment: a single container to schedule, no special hardware, reproducible from the committed lockfiles.

The data layer runs today on managed Postgres in the vendor's eu-west-2 region, chosen for the most consistent round trip time to Harare because the vendor offers no African region. Moving the data in country is a roadmap item aligned with Pillar 2 of the National AI Strategy on computational sovereignty. The deployment plan for the challenge window is: containerise the spine and run it in the CCE against a staging database; measure inference latency and throughput on the allocation; then stand up an in country Postgres with the same migrations and row level security, and cut the data layer over. The migrations, security tests and seed are all reproducible, so this move is exercised, not improvised.

The same national compute is the intended home for a second roadmap deliverable: a purpose built Shona model trained on ZCHPC, replacing the machine drafted strings with real modern nuance, planned in full against low resource machine translation evidence in a committed roadmap plan and never claimed as built.

## Milestones through the challenge window

The path is phase gated, and a phase closes only when its named proof exists, never on a calendar. Near term milestones, in order:

1. **Shona translator pass.** Every Shona string in the app is currently machine drafted placeholder text; an external Zimbabwean translator pass is owed before submission. This is a known, scoped gap, not a hidden one.
2. **More corridor ride days.** The corridor dataset grows with the team's routine travel through the same logger, and the arrival model promotes itself automatically the moment the data clears the promotion bar. A corridor ride day is planned with association contact.
3. **Voice guidance with consent.** Zimbabwean voice artists sign consent, and the in ride guidance audio is pre generated and cached so no vendor sits in the ride path. A placeholder voice ships if consent is not yet secured.
4. **CCE deployment test.** Containerise and run the spine in the ZCHPC CCE, measure latency and throughput, then rehearse the in country data cutover described above.
5. **Bootcamp and pilot readiness.** The Track 3 bootcamp runs in Mutare from 27 July to 1 August 2026. Svika enters it with a working product and a security suite, ready for milestone based support toward a corridor pilot.

*The exact AI4I submission deadline is not stated in the terms of reference we hold and must be read off the portal; it is flagged in `docs/proposal/TRACEABILITY.md` as an input owed before export.*
