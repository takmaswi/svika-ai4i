# Phase D gate report: the vision scenes

Date: 2026-07-11. Scope: three simulated scenes of what Svika becomes next,
joined to the Phase A story machinery, plus the sandbox shelf that keeps
them honest on the demo door. Nothing in this phase writes to any account.

## What shipped

**The crash flow, Tinashe's story** (`/vision/tinashe`). A staged sequence in
four story steps: the alert moment over the live corridor map (a marigold and
char warning card, the product's warning pair), his mother's phone receiving
the auto message whose link wears the real share my ride grammar, and the
responder view showing next of kin and medical aid in the exact field grammar
of the Phase C profile screen. The captions say plainly that crash detection
ships with the native app, not this build, and that the emergency details
feature itself is live today. The responder card renders fixture demo values
on purpose: the real emergency_details table is RLS locked and a public page
must never be able to read it.

**Gogo on her mbudzi** (`/vision/gogo`). A rendered old feature phone whose
keypad the judge really types on: dial *123#, press OK, and a menu answers on
the park LCD. Behind the screen sits a real menu state machine
(apps/web/src/lib/ussd, 13 unit tests written before the code) with CON/END
semantics and an injected effects adapter. The money menus (credit, booking,
claiming change) run fixture twins that move nothing. The how far menu calls
the same arrival wiring the home screen uses, through a read only server
action, and keeps the estimate's basis flag. The caption states what waits:
a telco aggregator agreement, which is a contract, not a build.

**Kombi capacity** (`/vision/capacity`). The corridor map with each simulated
kombi wearing the occupancy its conductor declares, as a section 7 place chip
riding above the untouched marker. The card underneath holds that declared
number against what redeemed tickets and check ins would prove, four fixture
kombis, one drifting. The drift line names the plate and the pattern, never a
person. The caption says this ships when real vehicles stream data.

**The sandbox shelf.** The demo door's story list is now two headed groups:
"Real stories, real money on the live system" over the four Phase A and C
stories (solid doors), and "Vision scenes, simulations of what ships next"
over the three new scenes (dashed link doors). The split reads in one glance,
and the vision doors are plain links that sign nobody in.

## The honesty architecture

- Every vision scene wears a permanent Simulation stamp: the demo movement
  chip's pill family without the signal dot, because signal red marks live
  truth only. E2e asserts the stamp on every scene in both themes.
- Vision stories carry `persona: "none"`. No sign in happens, no persona is
  claimed or reset, and no write path exists on any scene. This is stricter
  than the phase brief asked for ("no scene ever writes to real user data"):
  the scenes have no session at all.
- Story exits from vision scenes land on the landing page, not inside the
  app, through the new `exitPath` on the story definition.
- The disclosure register gained four rows (three scenes plus the shelf),
  each declaring exactly what is fixture, what is real code, and what waits
  on the world.

## Validation (all on the final commit)

| Check | Result |
| --- | --- |
| pnpm typecheck | clean across the workspace |
| pnpm lint | clean |
| Unit tests | 267 passed (shared 35, conductor 37, spine 87, web 108, incl. 13 new USSD machine tests) |
| pnpm test:e2e | 43/43, incl. 6 new vision tests (stamp in both themes, shelf split, Tinashe walkthrough, working keypad with live minutes, capacity badges and drift) |
| pnpm db:security-test | 97/97 |
| Ledger invariants | 8/8 |
| Offline suite | 34/34 |
| security-review skill | no findings on the Phase D diff |
| Build | clean; bundle numbers below |

One e2e repair rode along: `book.spec.ts` ("the ticket page shows the big
board code") started failing under the grown 43 test parallel load while
passing alone. The test lacked the suite's own hydration guard before
tapping the ticket and gave the final assertion only the 5 second default
while the ticket route pays its dev compile. It now waits for hydration,
declares `test.slow()` like its cash sibling, and budgets the assertion
honestly. Full suite green twice after the fix.

## Bundle numbers (next build, first load JS)

| Route | First load |
| --- | --- |
| / (landing with the shelf) | 124 kB |
| /vision/tinashe | 124 kB |
| /vision/gogo | 124 kB |
| /vision/capacity | 124 kB |
| /app (heaviest page) | 164 kB |

The three scenes ride the shared chunks; each adds about 1.5 kB of its own.

## Design law

Section 14 answered yes for every new surface; the addendum with item notes
lives in docs/design-evidence/MBARE-SUN-CHECKLIST.md. Four spec gaps are
flagged there as proposals, not improvisations: the Simulation stamp itself,
the message bubble pair on the kin view, the feature phone shell, and the
marigold and char warning card at card scale. The kombi map marker pipeline
is untouched; capacity badges are their own unrotated markers.

One mid build fix came out of the adversarial pass: the floating story
caption covered the mbudzi screen and the message card on shell pages. The
story bar gained an in flow variant for those views so the caption never
hides what it narrates; map scenes keep the floating bar.

## Evidence

- Screenshot packs at 360px, day and night, English and Shona:
  docs/design-evidence/shelf, vision-tinashe, vision-tinashe-kin,
  vision-tinashe-responder, vision-gogo, vision-capacity (24 shots).
- Back to back recording of all three scenes:
  docs/design-evidence/recordings/vision-scenes.webm.
- Regenerate with `node scripts/phase-d-evidence.mjs` and
  `node scripts/phase-d-recording.mjs` from apps/web.

## Decisions taken that Mhofu should ratify

1. Vision scenes are public routes with no session. If you would rather they
   sit behind the demo door sign in, say so and the doors become forms.
2. The responder view shows fixture values shaped like the real profile
   fields, because reading the real table publicly would mean weakening RLS.
3. Gogo's booking and claiming menus move no money at all, not even demo
   ledger money. The brief allowed either reading; the stricter one won.
4. The fourth fleet plate AFK 3311 is synthetic in the reference format
   (screen 6 provides only three plates).
5. The USSD short code *123# is a placeholder until an aggregator assigns
   a real one.
6. All new Shona strings are machine drafted placeholders; the standing
   translator pass before submission covers them.

## Plain language summary

Three new demo scenes show judges where Svika goes next: a crash alert
reaching a mother's phone, a grandmother booking by keypad on a brick phone,
and kombis showing how full they really are. None of them pretend. Each one
wears a Simulation badge in both themes, says out loud what is real code and
what is fixture, and cannot touch anyone's money or data because the pages
never sign in. The front door now shelves the real stories and the vision
scenes under separate headings so nobody confuses the two. Everything is
tested, screenshotted, recorded, and the full test wall is green.
