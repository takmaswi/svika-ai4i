# Checks parked for Mhofu

Open questions and numbers that need your eyes. None of them block the build.
Work continues on documented assumptions; you review this list when phase 1
is done. Each item says what was assumed and what changes if you disagree.

Last updated: 2026-07-10.

## 1. Watchdog simulator numbers (task 5)

Every number in `services/spine/src/watchdog/config.ts` except the fare is my
invention and needs your smell test. The committed metrics regenerate in one
command (`pnpm watchdog:eval`) if any change.

- 4 kombis per owner, 90 days of history
- 20 one way legs per weekday (about 10 round trips), 14 on weekends
- 16 seats, average load 72% weekday and 58% weekend, jitter 10%
- 35% of fares digital, 45% of fares in the two rush windows
- Fare 150 cents, the measured flat corridor fare (the one real number)
- Leakage on 8% of days, usually one kombi: a 30 to 50% skim of its cash
  fares, or a 45 to 65% skim of rush hour fares, or recording stopping mid
  afternoon

## 2. Return leg of the recorded rides (task 3)

The two field rides cover the corridor in both directions. The pipeline
treats the return ride as its own direction with its own segment times, not
a mirror of the outbound geometry. Confirm that matches how the kombis
actually run (same road both ways, or a different loop through town).

## 3. Ride upload attribution (task 3)

Ingested ride files are attributed to the maintainer account that runs
`pnpm spine:ingest`, since the script runs at seed trust on a maintainer
machine. If rides should carry the name of whoever rode and recorded them,
say so and the ingest gains a recorded_by field.

## 4. The demo estimate window (task 4)

About 20% of the time both simulated kombis run outbound at once, so a saved
trip toward town briefly shows the mock twin's "demo estimate" label instead
of a live number. Honest but visible. Decide whether that is fine for the
stage demo or whether the simulator should keep one kombi per direction at
all times.

## 5. Shona strings (all tasks)

Every Shona string in the app is machine drafted placeholder text. An
external translator pass happens before submission. New strings keep landing
in both languages but the Shona stays draft quality until then.

## 6. Account deletion design (task 6)

You asked for a delete action on the "what Svika knows about you" page. The
ledger and tickets are append only, so deletion anonymises instead of
erasing. Implemented design, built on your go but check the shape:

- Deleting removes your name and phone from the profile, deletes saved
  trips, and appends a consent withdrawal, all in one database function
- Ticket and money history stays (append only law) but no longer carries a
  name or phone; rows key to an opaque id
- The sign in email stays in the auth system until an operator removes the
  login; the page says this plainly rather than pretending full erasure
- After deletion the consent gate blocks the app again, so a returning user
  must consent afresh

If you want the login removed in the same action, that needs a service tier
job; flag it and it gets designed.
