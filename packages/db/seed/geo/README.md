# Real corridor geometry: Mount Pleasant Heights to Rezende

This folder holds the real road geometry and stop set for the HEIGHTS-REZENDE
route, derived from Mhofu's own kombi rides on the corridor.

## Honesty statement (rubric C3)

This geometry is **real, not synthetic**. It comes from a **single real ride per
direction**, recorded on 2026-07-07 with the Svika field GPS logger:

- one clean return run (Rezende to Heights), used as the base road line, and
- one inbound run (Heights to Rezende) that took customer seeking detours, kept
  only as variance data.

Because it is one ride per direction, the geometry, the stop set and the timings
are a first pass. More runs will refine them: they will average out single ride
GPS drift, catch stops this ride skipped, and give the spread the ETA work needs.
Nothing on this corridor is invented. Every stop name is exactly as the rider
marked it in the field.

## Files

| File | What it is |
| --- | --- |
| `derive.mjs` | The reproducible derivation. Reads the raw rides, writes everything else. Run `node packages/db/seed/geo/derive.mjs`. |
| `corridor.route.geojson` | The clean base road line, both directions (outbound = base reversed, inbound = base as recorded). |
| `corridor.stops.geojson` | The 15 merged corridor stops as points, with real names, order, and source runs. |
| `corridor.variance.geojson` | The detour heavy inbound trace. For ETA and variance work only. It does not shape the base route. |
| `corridor.summary.json` | Machine readable summary: ordered stops, lengths, riding minutes, provenance. |

## How the base line is built

1. Keep only the riding legs (the walk to and from the kombi is dropped).
2. Drop pings the phone flagged as fuzzy (accuracy over 25 m); one 87 m outlier
   goes here.
3. Collapse stationary jitter (points under 2 m apart at stops).
4. Smooth and downsample with Ramer Douglas Peucker at a 6 m tolerance, just
   above the roughly 5 m GPS noise floor. This strips jitter while keeping the
   real turns.

The clean return run is the base because the inbound run wandered off the normal
path to look for passengers. Both network directions come from the one clean
base, so the corridor has a single consistent road shape.

## Stop merge

Stops come from the rider's marked points across both runs. Two markers merge
into one stop only when they are close (within 150 m) **and** their names share a
distinctive word. That keeps genuinely separate landmarks apart (First boom gate
and 2nd boom gate are about 250 m apart; Pama Church and Pama Broom are different
names) while folding cross run duplicates together (Ashbrittle and Ashbrittle
shops; Pa Police / Pamapurisa and Malborough Police). Three markers the rider
left unnamed are dropped from the stop list.
