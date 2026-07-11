# Phase C gate report: the app becomes personal

Date: 2026-07-11. Every task proof named below exists in this repo; nothing
is asserted without a file behind it.

## What shipped

**Task 0, the kombi marker.** Verified, not changed: the glyph inside the
DESIGN.md section 10 box has been the client's exported asset since the
reskin (byte identical across `apps/web/public/map`, `packages/ui/assets`
and the client's own export folder). The reference screens' placeholder
never shipped on a map; its one surviving use is the wallet row list icon
from the purge pass. Fresh close ups, day and night, in
`docs/design-evidence/marker/` with the verification chain in its README.

**Task 1, the profile page** (`/app/profile`). Identity edits, saved trips
renamed and removed in place, ride history told warmly with mono dates,
commute alert and per language voice prefs on the language chip grammar,
and emergency details (next of kin, medical aid) with plain words on why
Svika asks. Emergency data has no client write path at all: security
definer RPCs store or remove it together with the recorded consent, in one
transaction (migrations 0023 to 0025). The emergency consent lives in its
own stream (`emergency-v1`) and a fix landed with it: all three app gates
now filter on the app stream, so withdrawing emergency consent can never
lock the app.

**Task 2, share my ride.** A rider with a live fare mints a 128 bit link
from the ticket page (migration 0026). The public viewer needs no account
and sees the route, the live map, the on board status and the arrival
estimate with its basis label, and states plainly what it cannot see: who
is riding, their phone, code or wallet. Links die on revoke, on any status
past redeemed, and when the ride window (code validity plus the route's
typical duration) passes. Wrong, revoked and expired tokens share one
quiet dead state.

**Task 3, commute alerts, honestly framed.** Spine 2 is deliberately plain
statistics and the writeup says so: `docs/SPINE-2-COMMUTE-ALERTS.md` names
the baseline (a fixed alarm clock) and why it loses: an alarm cannot know
today's supply. Patterns are mined from the rider's own tickets inside
their own RLS scope; the alert fires only inside the usual window when
Spine 1's live wait clears a threshold set just above the demo fleet's
worst arrival gap, and the card always shows what its minutes stand on.
Takunda ships as the demo persona; his two week history is fixture data,
enumerated ticket by ticket in `demo_commute_fixtures` (migration 0027).

**Task 4, the voice guide.** A geofence engine over the same simulated
positions the map draws: approaching, get off here, walking leg starts.
Audio is preloaded when the ride starts and played from memory; the unit
test counts fetches to prove zero network at play time. Screen readers
ride the same triggers through an aria-live region. Settings are per
language on the profile. The voices are labelled placeholders (local SAPI,
regenerable via `tools/generate-placeholder-voice.ps1`) until recorded
Zimbabwean voices land in P5, same file names, no code change.

**Task 5, two new stories.** Takunda's morning: the alert is live on
entry, he books from his quick pick, the simulated hwindi clears him, and
the voice speaks as his stop nears, the last stretch fast forwarded
through the real trigger engine with the caption saying so. Rudo's night
ride, staged in night theme: her wallet floated to zero by double entry
(migration 0028), a simulated friend whose $2 rides the real escrow RPCs,
a claim by code, a booking, and the mother's view, which is the real share
link rendered as a story step. Both run real money through the real
ledger. The disclosure register covers every tier change.

## Validation (all against the live database)

| Proof | Result |
| --- | --- |
| Typecheck and lint | clean across the workspace |
| Unit tests | 250 (shared 35, conductor 37, spine 87, web 91) |
| e2e, full suite | 37 of 37 in one run (5.5 min), including profile 3, share 2, commute 2, stories 2 |
| RLS security suite | 97 of 97 (was 75; new RP 1 to 4, ED 1 to 7, SH 1 to 11) |
| Ledger invariants | 8 of 8 |
| Offline boarding proof | 34 of 34 |
| Security reviews | profile and share my ride, both no findings at the confidence bar (threat models in the review transcripts) |

One test fix fell out of the gate run: the offline suite claimed
redemptions milliseconds after purchase with the client clock as the
moment; on a machine trailing the database by ~150 ms that reads as
"redeemed before the code existed" and the RPC rightly refuses it. The
claims now sit two seconds forward, inside the skew tolerance, the way a
real ride reads. No product code changed.

## Bundle numbers (next build, production)

| Surface | Size |
| --- | --- |
| Landing `/` first load JS | 122 kB |
| Heaviest app page `/app` | 161 kB |
| Profile `/app/profile` | 110 kB |
| Share viewer `/share/[token]` | 122 kB |
| Conductor PWA JS (gzip, total) | 94.6 KB |

The voice guide and map stay behind lazy chunks; the placeholder audio
(~650 KB of WAVs) is fetched only when a ride starts, never in a bundle.

## Evidence pack

- `docs/design-evidence/profile/` and `share/`: 360px, day and night,
  EN and SN, live values.
- `docs/design-evidence/marker/`: the task 0 verification close ups.
- `docs/design-evidence/recordings/`: `takunda-morning.webm` and
  `rudo-night.webm`, each from a fresh landing visit.
- `docs/design-evidence/MBARE-SUN-CHECKLIST.md`: the section 14 answers
  for every new surface, plus two new flagged spec gaps (a checkbox and a
  boolean toggle have no reference pattern; proposals recorded, nothing
  improvised beyond them).
- `docs/DISCLOSURE-REGISTER.md` and `docs/BUILD-LOG.md`: current.

## For Mhofu to know (decisions and open items)

1. **Task 0's premise did not hold**: the marker already carried your
   asset. If the wallet row's little bus icon (the reference placeholder
   path, kept by the purge pass so no arrow shape sneaks in) also bothers
   you, say so and it becomes a crop of your asset instead.
2. **"Voice on and off per language"** is built as two switches, an
   English voice and a Shona voice, with the app language picking which
   plays first. If you meant one switch plus a language choice, it is a
   small change.
3. **Share links die** at code validity plus the route's typical duration
   (worst honest bound for "the trip ends"), and immediately on revoke or
   cancel. There is no alight event in the system to end them sooner.
4. **The alert threshold is 20 minutes**, sitting just above the demo
   fleet's worst arrival gap; the writeup explains why and what tightens
   it with a denser fleet.
5. **The placeholder voices are knowingly wrong** (English SAPI reading
   Shona); they exist so the engine is real today. Your recorded voices
   and the translator pass on machine drafted Shona strings remain owed
   before submission.
6. Everything is committed on main. Push with your credentials:
   `! git push origin main`
