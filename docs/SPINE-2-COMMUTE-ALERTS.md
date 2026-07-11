# Spine 2: commute alerts

Status: live in the rider app. This spine is deliberately plain statistics,
documented as such. No model is trained here, and that is the point: the
rubric penalises forced AI, and a recurring trip is a counting problem, not
a learning problem. The intelligence in the alert is the live half, which
rides on Spine 1.

## What it does

1. **Mine the rider's own history.** `mineCommutePatterns` in
   `apps/web/src/lib/commute/patterns.ts` groups the rider's fare tickets
   from the last 28 days by stop pair. A pair becomes a pattern when it has
   at least 5 rides spread over at least 3 distinct days of the week. The
   usual departure window is the median departure minute plus or minus 45
   minutes, in Harare time (CAT, no daylight saving). That is the whole
   miner: grouping, distinct day counting, one median.
2. **Fire on live supply, not on the clock.** Inside the usual window, the
   app asks Spine 1 (the arrival predictor over the live vehicle feed) how
   far the next kombi on the usual pair is. The alert fires only when that
   wait is at most `ALERT_ETA_MINUTES` (20). The card always shows the live
   minutes and what the number stands on (recorded rides, or the labelled
   demo estimate when the mock twin serves).

Everything runs server side, inside the rider's own RLS scope, on the app
server. No cross rider learning, no rider data leaves their session, and
the spine service never holds rider identity for this feature.

## The named baseline: a fixed alarm clock

The baseline every commute product ships is an alarm: "your 07:45 kombi".
The alarm knows the rider's habit exactly as well as our miner does; what it
cannot know is today's supply.

- On a day the kombis run early or bunched, the alarm fires when the kombi
  has already gone. The alert instead stays quiet until a real vehicle is
  really approaching.
- On a day of sparse service (one kombi on the corridor, 40 minutes out),
  the alarm lies by omission; it fires as if the world were normal. The
  alert's threshold guard keeps it silent, because "near" would be false.
- The alarm's content is a time the rider already knows. The alert's
  content is the number the rider cannot know: the actual minutes until the
  actual next kombi, measured from the live feed by Spine 1.

A fixed alarm cannot know today's supply. That sentence is the whole
justification for wiring the alert to the live ETA rather than to the
mined median.

## Threshold honesty

`ALERT_ETA_MINUTES` is 20. The demo fleet is four kombis on the recorded
67 minute corridor cycle, phased so the worst gap between arrivals at a
rank is about 19 minutes; the threshold sits just above that, so within the
usual window the alert reads the actual next arrival. The guard is not
decoration: with sparser service the wait exceeds it and the alert stays
silent rather than calling a distant kombi near. With a denser real fleet
the same guard tightens naturally.

## Demo persona

Takunda (`demo.takunda@svika.app`) carries a two week daily commute,
Heights to Rezende, seeded as fixture data. Every fixture ticket is
enumerated in the `demo_commute_fixtures` table (migration 0027) and
rebuilt relative to the seed moment so the mined window is live whenever
the demo runs. No money moves for fixture rides. This is declared in the
disclosure register.

## Tests

- `apps/web/test/commute-patterns.test.ts`: the miner's thresholds (rides,
  distinct days, lookback, window), pattern ordering, window matching and
  the threshold guard.
- `apps/web/e2e/commute.spec.ts`: Takunda opens the app inside his usual
  window and the alert is on screen with live minutes and its basis label;
  a rider with no pattern and no pref never sees it.
