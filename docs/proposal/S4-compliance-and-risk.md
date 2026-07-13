# Section 4: Compliance and risk mitigation

*AI4I Challenge 2026, Track 3 Development. Draft for review. Page budget: 1 to 2 pages. Rubric anchors: C1 (security warnings, 30), C4 (feasibility, 20), and the terms of reference weak submission and disqualification flags.*

## Data protection: built to the Act, licensed before live processing

Svika is designed against the Cyber and Data Protection Act [Chapter 12:07] and its licensing regulations, Statutory Instrument 155 of 2024, which POTRAZ administers. The judge reading this section is the regulator, so the claims here are specific and checkable.

**Consent is a gate, not a checkbox at the bottom of a form.** No Svika surface touches personal data until the rider or conductor passes a first use consent gate, and the conductor gate works offline against a cached verdict. Consent is stored as an append only `consent_records` row under row level security, alongside a plain language privacy notice that lists exactly what Svika holds: profile, tickets, wallet ledger, saved trips. A rider can withdraw. The "what Svika knows about you" page runs an `anonymise_me` function that strips name and phone and deletes saved trips; because the ledger and tickets are append only by law, the page says plainly that history is anonymised rather than pretending full erasure (`docs/CHECKS-FOR-MHOFU.md`, item 7). All of this is built and tested, with 8 consent checks inside the security suite.

**Licensing is planned honestly for the point it is needed.** SI 155 requires any entity processing the personal data of 50 or more individuals to hold a data controller licence and to appoint a Data Protection Officer within 90 days. Today Svika processes only the team's own data and synthetic demo personas; it is not yet processing real riders at scale. The compliance plan is to register as a Tier 1 data controller, the USD 50 tier under SI 155, and to appoint a Data Protection Officer before the first real rider is onboarded, not before it is required. Naming this now, rather than claiming a licence we do not yet need, is the honest position and the one the Act actually expects.

**Breach notification is a documented procedure.** The Act requires a data controller to notify the Authority within 24 hours of a security breach, and to inform affected individuals within 72 hours where the risk to their rights is high. Svika's operating plan adopts both windows as written, and the appended consent and audit records give the factual trail a notification would need.

## Cybersecurity: integrity enforced in the database

The strongest security control in Svika is structural, not a bolt on. Row level security is on every table from the first migration, so authorisation is enforced by Postgres on every query, not by application code that a bug could bypass. An automated test proves rider isolation using the anonymous key alone (97 checks passing). The service role key exists only in the seed script and CI secrets and never in a running app. No secret is committed to the repository; `.env.local` is git ignored and `.env.example` documents every key. This directly answers the terms of reference disqualification flag on committing credentials, and the C1 requirement for code free of security warnings: the database advisor runs clean of actionable items.

Board codes are hardened by design: four digits, scoped to a route, direction and time window, with rate limited redemption and attempt logging, so a guessed or shared code cannot travel across the network. Fare purchase carries a plausibility guard and cash reservation. Every external provider, including the voice studio and any future money rail, sits behind an adapter with a mock twin, so no live vendor call sits in the ride path and the demo cannot die because a vendor is down.

## Model testing and AI risk

Each of the three AI spines ships with unit tests and a committed metrics file, so the model's behaviour is evidenced, not asserted (Section 2). Two AI specific risks get named product rules. First, forced AI: where a rule or query is sufficient, Svika uses it and says so, which is why the commute alert is statistics rather than a model. Second, accusation: the revenue watchdog flags a pattern, a day, a route, an unnamed vehicle, and never a person, and a unit test enforces that on the explanation templates. An owner sees "one vehicle on this route ran low on this day", never a named driver accused of theft.

## Honesty and adoption risk

Svika labels every feature by honesty tier, in the README and the disclosure register: Tier 1 real, Tier 2 clickable with a fixed backend and labelled on screen, Tier 3 slides only. We never present a Tier 2 surface to a judge as live. This is a deliberate guard against the terms of reference weak submission flags about polished screenshots with no working path, and against overclaiming AI performance. The dataset statement (Section 3 and C3) carries the same discipline for data: what is real, what is simulated, and how the simulator will be checked against real aggregates as they arrive.

Adoption risks are real and stated rather than hidden. Cash is always accepted and digital riders get no queue privilege, product law carried over from the ZUPCO post mortem, so Svika adds a record without punishing the rider who pays cash. The offline first conductor design assumes a cheap Android on a weak network, because that is the real device. The Shona in the app is machine drafted placeholder pending an external translator pass, which is flagged, not glossed over. None of these are fatal, and each has an owner and a plan.
