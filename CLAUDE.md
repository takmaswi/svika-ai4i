# CLAUDE.md — Svika rebuild (AI4I Track 3)
# Drop this at the root of the new repo. It governs every agent session on this codebase.

## What Svika is

Digital ticketing and trip intelligence for Harare's informal kombi network. Passenger first. Riders plan trips in Shona or English, board with a short code, and stop losing money to the change problem: unreturned change becomes USD wallet credit instead of leaving with the kombi. Conductors clear fares offline on their own phones and earn commission on digital fares. Owners get real revenue visibility, an AI watchdog on leakage, and statements that speak to ZIMRA's real presumptive tax ($50-60/month via ZINARA). Server side AI does three load bearing jobs: arrival prediction with no timetable, learned commute alerts, and revenue anomaly detection. A Zimbabwean voice guides riders in ride ("Wakusvika pa turn off, chiburuka"). Target: POTRAZ AI for Impact Challenge 2026, Track 3, bootcamp Mutare 27 Jul-1 Aug 2026.

Reference documents live in the owner's planning folder: PHASE-3-STRATEGY.md (product decisions), PHASE-4-BUILD-PLAN.md (phases P0-P6 with gates), COMBINED-EVIDENCE-BASE.md (verified facts), AI4I-RUBRIC-NOTES.md (scoring). When in doubt, those win over improvisation.

## How to work (Fable 5 operating rules)

1. **Phases with gates, no calendar.** Work P0→P6 from PHASE-4-BUILD-PLAN.md. A phase is done when its named proof exists (test output, video, metrics table), never when it feels done. Stop at every gate and show the proof before moving on.
2. **Evidence over assertion.** Claims about the code cite file and line. Claims about the world cite the evidence base or get web verified. Never invent statistics, fees, fares, place names, or kombi practices. Mhofu is the only source of truth for Harare geography and informal network behaviour.
3. **Adversarial self review.** After building anything, attack it: what breaks on stage, what a judge pokes, what a hostile user does. Fix or log before declaring done.
4. **Consult before product decisions.** Feature, scope, or architecture changes get flagged and explained to Mhofu first. Never silently choose on irreversible or product shaping calls.
5. **Honesty tiers everywhere.** Tier 1 real and working. Tier 2 clickable with fixed backend. Tier 3 slides only, never in code. The README and the demo disclosure register label every feature. We never overclaim to judges; the on device Gemma lesson is not repeated.
6. **Plain language summaries.** After any technical document or gate report, give Mhofu a short plain English summary. No jargon walls.
7. **Writing style, hard rules:** no em dashes, no hyphenated compound words, run the humanizer pass on prose deliverables (README, proposal text, deck copy).

## Non negotiables (rubric: C1 code quality is 30%)

- **RLS on every table from the first migration.** The service role key exists only in the seed script and CI secrets. An automated test proves one rider cannot read another's tickets or wallet. Any PR weakening RLS is rejected.
- **Money is a double entry, append only ledger.** No mutable balance columns. Ledger invariant unit tests (money cannot be created, lost, or double spent) must pass before any wallet feature merges.
- **Tickets are event sourced.** State changes append ticket_events rows. Never UPDATE history.
- **Unit tests ship WITH the feature**, not after: ledger, fares, planner, code redemption, anomaly logic. Playwright e2e per user flow. CI (typecheck, lint, test) green before every merge.
- **Small conventional commits** (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Judges read the git history. No single commit dumps.
- **Lockfile committed, dependencies pinned.** The rubric names unlocked manifests as a mark down.
- **Secrets never in the repo.** `.env.local` only, `.env.example` documents every key. No key from any chat or doc gets pasted into code.
- **Board codes v2:** 4 digits, scoped to route + direction + time window, rate limited redemption with attempt logging. Never regress to global 3 digit codes.

## AI layer rules (rubric: C2 AI justification is 30%)

- Three spines only: ETA prediction, commute alerts, revenue anomaly. Each keeps a named baseline (naive average, alarm clock, fixed threshold) and a metrics table proving the model beats it on held out data. If a feature can be done with a query or a rule, do it with a query or a rule and say so; forced AI is heavily penalised.
- All inference server side (deployable to ZCHPC CCE). No model inference on rider phones.
- Every external AI or service call goes through an adapter with a mock twin: providers are swappable, the demo never dies because a vendor is down, and no live vendor call sits in the ride path. Voice audio is pre generated and cached (ElevenLabs is a studio tool, not a runtime dependency).
- Anomaly outputs flag patterns, never accuse a named person. This is a product rule, not a tone suggestion.
- Dataset statement (rubric C3, 20%) is a maintained file: what data is real (corridor fieldwork), what is synthetic (simulator, generation method documented), and the statistical validation of synthetic against real. Update it whenever data changes.

## Design and UX best practices

- **Brand v2 "Forest / Bone / Signal" is the only truth.** It lives in Mhofu's Claude Design project ("Svika Design System") and is exported into this repo. The teal/rust/Geist palette in older docs is dead; never reintroduce it.
- Core tokens: forest green `#1F4D2E` (CTAs, headers, wordmark, active states; hover deepens forest to pine), char `#0E1A12` ink, bone `#FFFCEF` background (never pure white), linen `#E9E2C8`, signal coral `#E84C30` as the single accent, moss `#4D5C44`, amber `#F59E0B` for warnings only.
- Type: DM Sans 700 as the display voice, IBM Plex Sans for body and UI, IBM Plex Mono as the receipt voice (access codes, fares, plates, counts). The wordmark is bespoke: the route-S mark plus "vika" in Baloo 2 700. Use the exported `logo.svg` and `wordmark.svg`; never rebuild or substitute the mark.
- Surfaces: flat bone or linen, no stock photography, the live map is the only imagery. Glass (frosted bone, 20-28px blur, 10% ink hairline) exists only floating over the map. Cards are opaque bone, 14px radius. Radii scale 8/14/22/24/full. Shadows are always warm green black (`rgba(14,26,18,...)`), never neutral grey; the primary CTA carries the forest glow.
- Motion: gentle fade ups (280-600ms, ease out), bottom sheet spring `cubic-bezier(0.32,0.72,0,1)`, press feedback is `scale(0.99)` never a colour flash, everything respects reduced motion.
- Icons: the bespoke chunky rounded set (Icon component) with full block arrows and the kombi glyphs, `fill: currentColor`. No icon fonts, no icon libraries, no emoji anywhere in the product.
- Copy: second person and direct, short and concrete, bilingual English/Shona by default, sentence case (uppercase only for tiny meta labels), audit language flags patterns and never accuses a person.
- Token flow: design tokens, components, and assets enter this repo only as exports from the design system project (into `packages/ui`). Hand editing tokens in this repo is forbidden; change the design system, re-export.
- Mobile first always; reference device is a cheap Android at 360px on a slow connection. Bundle discipline: no heavy libraries for small jobs.
- Conductor surface: fat finger first. Big targets, high contrast, one action per screen, works in sunlight, works offline, survives a moving kombi.
- Offline first is architecture, not a feature: conductor PWA syncs a local ticket cache; queued writes reconcile with first sync wins and conflicts flagged.
- Accessibility is in scope: screen reader labels, large text mode, the voice guidance doubles as the accessibility channel (free tier for blind and low literacy riders).
- Language: every rider facing string exists in English and Shona from the start (Ndebele is roadmap). No hardcoded English in components; strings live in a translation file.
- No dark patterns, no queue privileges for digital riders, cash always accepted. These are product law from the ZUPCO post mortem.

## Skills to invoke

`frontend-design` for rider, conductor, and owner surfaces · `security-review` on anything touching money, codes, tickets, or auth · `systematic-debugging` when stuck · `verification-before-completion` at every phase gate · `humanizer` on all prose · `pptx`/`pdf` for the deck and proposal export · `docx` only for intermediate drafts (final proposal is PDF per rules).

## Validation before any "done"

```bash
pnpm typecheck && pnpm lint && pnpm test        # every task
pnpm test:e2e                                    # phase gates
pnpm db:security-test                            # RLS proof, phase gates and any auth/RLS change
```

A failure means not done. Append one line per completed task to `docs/BUILD-LOG.md`: `<phase> | <task> | <commit> | <proof>`.

## Cut from code (slides only, do not implement)

Native app with crash detection and speed scoring · voice INPUT in Shona (waits for the phrase dataset) · real EcoCash/InnBucks API money movement (adapters + mock only) · USSD aggregator · WhatsApp Business API · ZUPCO integration · dynamic pricing · dispatch. If asked to build any of these, flag the conflict instead of building.

## The five inputs owed by Mhofu (blocking P0)

1. AI4I proposal submission deadline from the portal.
2. New empty GitHub repo + fresh Supabase project, access shared; old chat exposed PAT revoked.
3. Public repo yes/no (recommended: yes, judges score history).
4. A corridor ride slot for the real data day (P3) and any association contact.
5. One or two Zimbabwean voice artists willing to sign consent (P5); placeholder voice ships if not.
