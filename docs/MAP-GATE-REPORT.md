# Map excellence gate report

Date: 2026-07-11. Scope: the four jobs of the map excellence pass (marker,
movement, camera, polish), each with evidence. Compared against e hailing
apps, not student projects.

## 1. The marker

The client's kombi asset (`apps/web/public/map/kombi-marker.svg`, verified
byte identical to its first commit c877649) is the map marker again:
standalone at its pre reskin 44px, rotating with the road heading via the
marker's map aligned rotation. The DESIGN.md section 10 marigold box is gone
from live map markers and stays everywhere else. Bob, night glow and the
night headlight beam ride on the standalone kombi. Recorded as agreed
deviation 3 in `docs/DESIGN-DEVIATIONS.md`.

Evidence: `docs/design-evidence/marker/` (home and close up, day and night),
`docs/map-evidence/recordings/marker-closeup.webm` (night, zoomed to the
marker, beam and glow live).

## 2. Movement

`docs/MAP-MOVEMENT.md` documents the pipeline as found, then the fixes.

Profiled headed at 4x CPU throttle (cheap Android stand in), 360x740, 20 s
samples, tracing the rAF cadence and one marker's actual CSS transform
(`apps/web/scripts/map-fps.mjs`; raw JSON in `docs/map-evidence/fps-*.json`).

| Metric (4x throttle, 20 s) | Before | After |
|---|---|---|
| Animation frame rate | 60.0 fps | 60.0 fps |
| Frame time p95 / max | 19.7 ms / 25 ms | 19.0 ms / 24.3 ms |
| Marker transform samples on fractional pixels | 0 of 1201 | 1202 of 1202 |
| Distinct marker position changes | 12 (whole 1px ticks) | 1201 (every frame) |
| Median step between changes | 1.0 px | 0.02 px |
| Largest single heading step | 16.3 degrees | 0.14 degrees |

The headline: the rAF loop was never the problem, even throttled 4x the page
holds 60 fps. The jank was quantisation. MapLibre markers default to whole
pixel rounding, so a kombi covering ~0.6 px/s rendered as one visible 1 px
tick every couple of seconds, and the heading snapped by up to 16 degrees at
polyline vertices. Two fixes, no change to how the simulation generates
positions:

- `subpixelPositioning: true` on every kombi marker: the browser now
  composites a continuous sub pixel drift (12 discrete jumps in 20 s became
  1201 continuous micro moves).
- `smoothedHeadingAtDistance` (chord bearing over 8 m of road either side)
  replaces the raw per segment bearing, so turns sweep through corners
  (16.3 degree snaps became 0.14 degree steps), unit tested in
  `apps/web/test/map-geometry.test.ts`.

Dwell at ranks and recorded touting stops was already deliberate (recorded
ride curves plus the 45 s turnaround) and is unchanged.

Evidence: `docs/map-evidence/recordings/movement-before.webm` vs
`movement-after.webm`, both 25 s at 4x throttle on the same corridor view.

## 3. The camera

Policy decided and documented in `docs/MAP-CAMERA.md`: the home map opens on
the boarding view (the rank the peek card quotes, its neighbour stops and
the nearest kombi, sheet aware padding, zoom capped at 15), the whole
corridor is one tap away on a glass toggle chip, the plan screen frames the
planned trip above its sheet, the landing keeps the full corridor. The
section 12 entrance now runs on the live map: route draws from the rank
along the real road, stop pins and labels fade in, kombis fade in and move
last. Reduced motion skips the sequence entirely and keeps discrete once a
second steps. Three spec gaps flagged in MAP-CAMERA.md rather than
improvised into DESIGN.md.

Evidence: `docs/map-evidence/recordings/camera-entry.webm` (fresh load at 4x
throttle: the entrance order is visible after genuine load time) and
`camera-trip.webm` (planned Pa embassy to Rezende trip framed above the pay
sheet).

## 4. Polish sweep

- Stop pins and labels legible day and night at every zoom used (packs
  re shot: `docs/design-evidence/{landing,home,plan}/` all four variants).
- Street label collisions: stop labels hold minzoom 12 so the wide view
  stays clean; MapLibre symbol collision handles the rest; halos on both
  themes.
- Route line: dotted char at .85 by day, dotted white at .75 by night,
  verified on the re shot packs.
- Attribution moved to the top right below the chip row, so it never hides
  under the peek sheet or overlaps the demo chip, the view toggle or the
  sheet.
- Reduced motion honoured everywhere: no entrance sequence, markers present
  immediately (probed: 4 markers, opacity 1, 1.2 s after map ready), bob,
  beam and fade animations off, view toggle jumps without easing, feed
  falls back to discrete ticks.
- Day close up checked for the white kombi body on the near white canvas:
  the asset's char outline and contact shadow carry it.

## Validation

- Typecheck and lint: clean across the workspace.
- Unit: 254 passing (web 95 including 4 new smoothed heading tests,
  conductor 37, spine 87, shared 35).
- E2e: 37/37 including the map spec (movement asserted in coordinates).
- RLS 97/97, ledger 8/8, offline 34/34.
- Build: /app first load 161 kB, /app/plan 111 kB (no new dependencies;
  the camera and entrance ride on code already shipped).

## Honesty notes

- All kombi movement remains the declared simulation replaying the two real
  2026-07-07 rides; nothing in this pass changed how positions are
  generated, so the map and the server side ETA caller still agree.
- The before/after frame rate is the same 60 fps; the felt improvement is
  quantisation, not throughput, and the table says so plainly.
- Shona for the two new toggle labels is machine drafted like the rest of
  the file and waits on the external translator pass.
