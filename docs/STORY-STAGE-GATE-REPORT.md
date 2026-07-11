# Gate report: the presentation stage and the intelligence shelf

Date: 2026-07-11. Scope: story mode becomes a proper stage (watch only
screens, captions that never cover content, no dead ends) and the shelf
gains The intelligence, three doors that point straight at the three AI
spines without a single overclaim.

## What was built

### Workstream 1: the presentation stage

1. **Watch only until the unlock.** While a story runs, the page renders
   inside a stage (`StoryStage`): everything under the lock carries the HTML
   `inert` attribute, so taps, typing and navigation on the app surface are
   dead and the script cannot be derailed. The story controls (next, back a
   step, exit) are the only live elements. The final step drops the lock and
   says so on screen: "Now try it yourself. Everything on this screen is
   live." (vision scenes say the scene is a simulation instead).
2. **Captions never cover content.** The caption band sits in flow below the
   screen box on phones, so it can never hide cards, codes or the map focus.
   At desktop widths (900px and up) the stage becomes a phone sized frame
   (360px, section 8 card grammar, spec gap proposal 10) centred beside the
   caption card, so a judge on a laptop sees the narration and the untouched
   screen at once.
3. **No dead ends.** Every step of every story and scene carries the visible
   exit, which lands on the shelf (`/#shelf`). Finishing a story offers two
   doors: back to the stories, or stay and explore. Browser back walks down
   the steps and out to the landing; e2e proves the whole matrix.

### Workstream 2: the intelligence shelf

4. **Three doors between real stories and vision scenes.**
   - *How Svika knows your arrival*: a pooled persona story from the live
     map's arrival number to `/app/intelligence`, the honest ladder page.
     The metrics table imports `services/spine/metrics/metrics.json`, the
     same committed file the serving code reads, never retyped numbers.
   - *Takunda's alert*: the existing story, relabelled on this shelf as
     spine 2 at work (learned routine against the alarm clock baseline).
   - *The watchdog catches a leak*: the demo owner's dashboard, a live
     injected bad day, the fixed threshold rule silent while the forest
     flags, and the bilingual narrative closing on the never a person rule.
5. **Provenance at the point of use.** Every basis label under an arrival
   estimate (home peek card, commute alert, saved trips, public share
   viewer) answers a tap with a small honest card: where the number comes
   from, how many recorded rides, what improves it, and for the mock twin,
   that it is not a measurement.
6. **Register and copy.** New register rows for every surface, bilingual
   strings from the translation file, honesty words (measured, learned,
   simulated) where each is true, no em dashes, no hyphenated compounds.

## The injection design, flagged for ratification

The goal asked door three to run the existing one command injection
(`pnpm watchdog:bad-day`) live. That script holds the service role key and
its own header places it in the seed trust tier, never inside any app, and
the repo's non negotiables keep the service key out of the app entirely. So
the injection was built as a staged swap instead:

- The committed pipeline (`watchdog:run`) now simulates and scores **both**
  variants of its end day (clean and heavy skim) with the promoted forest,
  and stages them in service role only tables (migration 0029).
- The story's inject step calls `demo_watchdog_set_day('bad_day')`, a
  security definer RPC that only a demo flagged owner can call and that only
  moves the caller's own synthetic rows. Entering the story resets to the
  clean variant, so every run shows the before and after honestly.
- Nothing scores in the app and no key leaves the pipeline. The verdicts the
  judge reads (forest flagged, threshold silent) are the pipeline's own,
  proven by unit test (`watchdog-score.test.ts`) and live in the database.

If shelling the real command on stage is preferred, that stays possible on a
maintainer laptop; the app path cannot do it without breaking the key rule.

## Other decisions awaiting ratification

1. **Takunda's door moved, not duplicated.** The real stories row now holds
   town, transfer and Rudo; Takunda's alert lives under The intelligence
   with its spine 2 label. One door per story keeps the shelf readable.
2. **Exits land on the shelf for signed in personas too.** Exiting a story
   leaves the app surface and lands on `/#shelf` (session kept, the demo
   chip and free roam are one tap away through stay and explore). The
   previous behaviour dropped exits into `/app`.
3. **Spec gap proposals 10 to 12** (desktop stage frame, scrim dialog,
   verdict pair line) in `docs/design-evidence/MBARE-SUN-CHECKLIST.md`.
4. **The demo account chip on the desktop stage** stays fixed to the browser
   viewport, so it reads as stage level disclosure above the frame rather
   than device chrome inside it. Flagged in case a chip inside the frame is
   preferred.
5. **Pre existing drift noted, not touched:** `demo_float_mine` was missing
   from `packages/db/src/database.types.ts` before this work; the new RPC
   and tables were added there, the old gap left for a dedicated pass.

## Evidence

- **Packs** (`docs/design-evidence/`): `stage/<slug>/step-N-360.png`,
  `step-N-1280.png` and `step-N-360-sn.png` for every step of all nine
  stories (caption and screen never overlap by construction: separate
  layout boxes; verified visually on every shot); `intelligence/`,
  `eta-provenance/`, `owner-watchdog/` and the reshot `shelf/` at day and
  night in English and Shona.
- **Recordings** (`docs/design-evidence/recordings/`):
  `intel-door1-arrival.webm`, `intel-door2-takunda.webm`,
  `intel-door3-watchdog.webm`, the three doors run end to end by the e2e
  suite.
- **Validation** (final run on this code): see the build log entry for this
  gate. Typecheck and lint clean; unit tests green across the workspace;
  the full Playwright suite green including the new `exits.spec.ts` (exit
  from every step and scene, back never traps), the presentation mode test
  (inert mid story, live after the final step) and `intelligence.spec.ts`
  (all three doors); RLS suite green including WD-8 to WD-12 for the staged
  swap; ledger and offline suites untouched and green.

## Plain words for Mhofu

Stories now run like a stage play. The judge can watch but not touch until
the last step, where the app says "now try it yourself" and everything goes
live. The caption sits under the screen instead of on top of it, and on a
laptop the app stands in a phone shaped frame with the caption beside it.
There is always a way out, back to the list of stories, from every single
step.

The shelf also gained a third row that shows off the AI honestly. One door
shows where the arrival number comes from, with the real evaluation table
on screen. One door is Takunda's alert, named for what it is: the learned
routine beating a fixed alarm. One door lets a judge plant a theft in the
simulated history and watch the old fashioned rule miss it while the forest
catches it, in English or Shona, never naming a person. Tapping the small
label under any arrival number now opens a card that tells the same truth
everywhere in the app.

One thing to decide: the goal asked the theft demo to run the maintainer
command live. That command carries the master database key, which our own
rules keep out of the app, so the theft day is precomputed by the same
trusted pipeline and the story just reveals it. The result on screen is
identical and every number is real pipeline output.
