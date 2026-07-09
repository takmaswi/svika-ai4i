# BUILD-LOG

Append-only. One line per completed task: `<phase> | <task> | <commit> | <proof>`
P0 | scaffold: workspaces, CLAUDE.md, README pushed (CI held back, token lacks workflow scope) | 06d699a | repo live
P0 | supabase project svika created, eu-west-2 (closest consistent RTT to Harare, no African region offered) | 0f81225 | project ref xbsawnsdvibarhjobvrm ACTIVE_HEALTHY
P0 | core schema migrations 0001-0005: identity, network, ledger, tickets, hardening; RLS on every table at creation | 0eea247 | supabase migration history + advisor rerun clean of actionable items
P0 | RLS security test, 29 checks passing with anon key only (rider isolation, no money printing, append only history) | b9f6dda | test output in P0 gate report
P0 | generated TS types + env wiring (.env.local real values git ignored, .env.example documents every key) | a0adc0b | packages/db/src/database.types.ts
P0 | advisor fix: moved RLS helpers current_owner_id/is_party_to_transaction into non-exposed private schema (revoke alone broke RLS) | 4080c55 | 2 helper advisor warnings cleared, security test still 29/29
P0 | monorepo tooling: services/\* workspace, flat ESLint, Prettier, root scripts, pinned lockfile | a115752 | pnpm install --frozen-lockfile clean
P0 | @svika/ui Brand v2 token package exported from the design system (Forest/Bone/Signal) | 3b73789 | apps link @svika/ui/styles.css |
P0 | @svika/shared money/fares/roles/types with unit tests | 203810b | 14 tests pass
P0 | services/spine AI scaffold: three spines behind adapter + mock twin, /health | 2fd5ee7 | 5 tests pass
P0 | apps/conductor offline-first PWA scaffold with queue logic | e11f5ad | 3 tests pass
P0 | apps/web Next.js shell: phone OTP auth, derived roles, session middleware, bilingual EN/SN | 96ae32e | next build passes, 2 i18n tests
P0 | idempotent demo seed: rider/owner/conductor with roles + $10 rider credit | 70b06bd | seed run created 3 users
P0 | auth flow proof: seeded demo user signs in via anon key, session + role resolve under RLS | 96ae32e | pnpm auth:verify 4/4 PASS, role=rider
P0 | CI workflow: typecheck/lint/test on push + PR | fe4c687 | green locally across 6 workspaces (24 tests)
P1 | network v2: transfer_points + dated fare_segments, Mhofu verified network seeded at 2026 fares ($1.00-$2.00 band, effective 2026-03-07) | 46e2d6f | seed idempotent, 12 dated segments live
P1 | graph planner with transfer penalties + free text resolver in @svika/shared | ee698a7 | 16 unit tests incl. every-stop-pair gate (110 pairs)
P1 | purchase v2: stop scoped fares, cash reservation, fare plausibility guard (migrations 0008/0009 applied) | ddf1811 | RLS suite 29/29 after change
P1 | rider search -> plan -> pay surface, bilingual, stop picker degrade | 065b43b | book.spec.ts 5/5 e2e green
P1 | conductor online redeem keypad, full screen verdicts | 9296528 | redeem.spec.ts 2/2 e2e green
P1 | change to credit RPC + hwindi note picker (migration 0010 written, apply pending vendor outage) | d9f6d39 735bf4d | change.spec.ts committed
P1 | split a note: covered fares stepper + RPC support | 735bf4d | split.spec.ts committed
P1 | credit transfers: send/claim/cancel, escrowed, rate limited (migration 0011 written, apply pending) | fb0ffc3 | transfer.spec.ts + RLS transfer checks committed
P1 | parcels: LOAD/COLLECT codes, stage aware redeem (migration 0012 written, apply pending) | 9bc7e00 | parcel.spec.ts committed
P1 | owner ledger view from postings (migration 0013 written, apply pending) | d33bced | owner.spec.ts committed
P1 | ledger invariant proof vs live db + demo wallet refills | 2494d82 | 8/8 PASS (zero sum, balanced, append only, no printing)
P1 | security review of full P1 diff (skill, subagent) | - | no high confidence findings
P1 | gate close: migrations 0010-0013 applied (enum steps split per Postgres txn rule), types regenerated, full e2e green | b453fce..76b3c55 | e2e 16/16, RLS 37/37, ledger 8/8 (35 txns balance), planner every stop pair, docs/p1-evidence recordings
P2 | offline spine: hashed cache pull, idempotent sync RPCs, anomaly_flags live, one settlement path shared with online (migration 0014 applied) | 1b949d6 | RLS suite 37/37 after apply
P2 | offline cycle proof vs live db: settle once, replay no-op, first sync wins + flag, change credited once, ledger zero sum | 00980be | 34/34 twice back to back
P2 | conductor offline libs: IndexedDB cache, skew corrected local engine, ordered idempotent flush | 3060f62 | 34 unit tests
P2 | hwindi offline UI: keypad fallback, status pill with queue count, queued change credit, EN/SN | b597c11 | offline e2e green
P2 | installable PWA: workbox precached shell, routes + shift survive offline cold start | bb673f6 09b51ef | build emits sw.js, 9 entries precached
P2 | rehearsal reset for attempt log + e2e wallet headroom (migration 0015 applied) | a527ef3 | back to back suites deterministic
P2 | offline e2e: airplane redeem -> reconnect reconcile, device double entry refused, online-vs-offline conflict flags | fdb1324 | 3/3, full suite 19/19
P2 | security review fixes: conductor scoped receipts, coarse rejection reasons (migration 0016 applied) | 9830170 | offline proof rerun 34/34
P2 | CI job for the live db offline proof, secret gated | ae30a19 | activates when repo secrets land
tool | gps-logger field PWA: journey as walk/wait/ride legs, mode+leg tagged pings, marked stops, IndexedDB crash safe, GeoJSON+CSV+bundle export shaped for gps_pings/stops | <pending> | typecheck clean, 28 unit tests, PWA build 10KB gz
P3 | real Heights<->Rezende corridor from two field GPS rides: clean return base line (23 vertices, ~13.5km, ~27min), touty inbound kept as variance, 15 real named stops merged, GeoJSON exports for the map | 1296c78 | derive.mjs reproducible, geo/ exports + summary
P3 | seed real corridor as HEIGHTS-REZENDE (flat $1.50, both directions), CBD routes kept for planner connectivity, stale walking_junction dropped | 4eba79d 9648709 | seed idempotent (run 2 no network change), live planner 462/462 pairs reachable, fare 150c
map | polyline geometry core + corridor geojson parsing, maplibre-gl 5.24.0 pinned | 6ea8da7 | 17 unit tests (haversine, headings, clamps, real corridor length within 1%)
map | warm Brand v2 map style: every colour repainted (greys to bone, water to sage, greens calmed), MapTiler url builder | 6172415 | 14 unit tests incl. expression trees and no-pure-white rule
map | VehicleFeed adapter + simulated kombi mock twin: ping-pong along the real line at the field-measured ~30km/h, dwell at ranks | b68e857 | 9 unit tests (position, turnaround, cycle, fake timers)
map | LiveMap component: warm style, forest route line, 15 real stops with names, kombi SVG markers rotating to heading with rAF glide, reduced motion honoured, demo movement chip | c877649 | map e2e green, canvas pixel proof
map | map-first rider home: full-bleed map, glass wordmark/theme/language chips, peeking bottom sheet with search wired to the existing plan flow, sheet opens itself after booking | e7f121c ae341a8 | book.spec 5/5 (also repointed stale stops/fares to the real corridor)
map | saved trips: migration 0017 (owner-only RLS, applied), nickname save/rename on the plan page, home quick picks with mock ETA labelled "demo estimate" | 941b3b1 cf47a54 | RLS suite 43/43, saved-trip e2e 2/2, 4 eta unit tests
map | warm night theme: dark tokens added to the design system export and re-exported to packages/ui, cookie stamped before paint, bespoke sun/moon toggle | b8edf67 | theme e2e green, dark screenshots
map | gate close: maplibre css had zeroed the canvas container (map + markers clipped invisible), fixed with explicit sizing; stale change/split fares repointed; evidence pack in docs/map-evidence | see log | unit 115, e2e 23/23, RLS 43/43, ledger 8/8, demo gif + recordings
polish | conductor route assignment: migration 0018 gates pull/redeem/sync RPCs behind an active shift route, refusals coarse + audit logged, seed assigns demo/test corridors, hwindi keypad shows the verdict | 004a7cc fc09dc3 | RLS suite 50/50 incl. 3 named ASSIGN proofs, offline suite 34/34, 37 conductor unit tests, security review skill: no findings
