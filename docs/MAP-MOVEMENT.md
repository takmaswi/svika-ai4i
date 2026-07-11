# How the demo kombis move

Audit written 2026-07-11, before the map excellence fixes, so the before state
is on record. The "What changed" section at the end was added after the fixes
landed. Everything here describes `apps/web`, the rider map.

## The one sentence version

Four simulated kombis replay two real recorded rides along the real corridor
road, the map asks the simulation "where is everyone right now" on every
animation frame, and each answer is handed to a MapLibre DOM marker.

## The simulation

There is no live GPS feed from kombis yet. `SimulatedVehicleFeed`
(`apps/web/src/lib/map/vehicle-feed.ts`) is the mock twin, declared in the
disclosure register. It replays the two real field rides recorded on
2026-07-07 along the Heights to Rezende corridor:

- The road itself is the real corridor polyline from the field export
  (`packages/db/seed/geo/corridor.route.geojson`), measured once into a
  metres along the line coordinate (`measurePolyline` in `geometry.ts`).
- Each direction keeps its own recorded time curve in `sim-profile.json`
  (outbound 157 checkpoints over 2326 s, inbound 107 over 1579 s), derived by
  `scripts/derive-sim-profile.mjs` from the ride bundles, never hand edited.
- A kombi's day is a loop: replay the outbound curve, dwell 45 s at the far
  rank, replay the inbound curve, dwell 45 s at the near rank, repeat.
- Between recorded checkpoints the sim interpolates with a monotone cubic
  (Fritsch and Carlson tangents), so a kombi eases through speed changes and
  never rolls backwards. Where the real kombi paused to tout, the simulated
  one pauses too.
- Position is a pure function of wall clock time from a fixed epoch
  (`SIM_EPOCH_MS`), so the server side ETA caller and the map always agree,
  and any two devices show the same fleet.

The fleet is four kombis (`standardFleet`), phase shifted unevenly along the
cycle so two ride each direction at any instant and headways never metronome.

## How often positions update

Two paths, chosen at map load in `LiveMap.tsx`:

- **Normal**: a `requestAnimationFrame` loop calls `feed.sample(Date.now())`
  every frame. The sim being a pure function of time means every frame gets
  the exact position along the road for that instant. There is no tick to
  interpolate between; sampling is continuous by construction.
- **Reduced motion, or a future real GPS feed**: `feed.subscribe` delivers
  discrete positions once a second (`TICK_MS = 1000`) and the marker steps.
  This is deliberate under reduced motion.

Once a second the rAF path also stamps `data-lng`, `data-lat` and
`data-heading` on each marker element so the e2e suite can assert movement in
coordinates instead of pixels.

## How the marker gets moved

Each kombi is a `maplibregl.Marker` with a custom DOM element
(`makeKombiElement`), created once and updated with
`marker.setLngLat(...).setRotation(headingDeg)` per sample.
`rotationAlignment: "map"` makes the rotation a compass bearing on the map.
MapLibre projects the lng/lat to a screen point and writes a CSS transform on
the marker element. The idle bob and the night headlight beam are CSS
animations on children of that element, so they ride along untouched.

## Why it did not feel smooth (the before findings)

Profiled at 4x CPU throttle in Chrome (cheap Android stand in); numbers in
`docs/MAP-GATE-REPORT.md`.

1. **Whole pixel snapping.** MapLibre markers default to
   `subpixelPositioning: false`: the library rounds the projected screen
   position to whole pixels before writing the transform (confirmed in
   maplibre-gl 5.24.0, `this._pos.round()`). At home zoom a kombi covers only
   a few pixels per second, so continuous sampling still rendered as visible
   1px ticks. The e2e suite had already noticed ("pixel positions round away
   at corridor zoom") without joining the dots.
2. **Rotation snapping.** `headingAtDistance` returns the bearing of the road
   segment under the kombi, which is piecewise constant: the heading jumps at
   every polyline vertex and `setRotation` snaps to it. On the curvy stretches
   of the corridor that read as a twitch every few seconds instead of a sweep.
3. **The camera hid the motion.** The home view fit the whole corridor into
   the container including the 396px band under the peek sheet, so kombis
   rendered small, slow and half hidden. Small plus slow plus snapping is
   exactly the "ticking" feel. Camera policy is its own document,
   `docs/MAP-CAMERA.md`.

What was already right: sampling is per frame and glued to the road (no
missing interpolation between sim samples), dwell at ranks comes from the
recorded rides plus the 45 s turnaround so pauses are deliberate, marker DOM
is created once and never rebuilt, and the bob and beam animations live on
child elements so they never fight the marker transform.

## What changed (the fixes)

1. **Sub pixel transforms**: every kombi marker is created with
   `subpixelPositioning: true`, so MapLibre writes fractional pixel
   transforms and the browser composites the drift smoothly.
2. **Eased heading**: the marker no longer takes the raw segment bearing.
   It takes the bearing of the short chord through the kombi's position
   (8 m of road either side, `smoothedHeadingAtDistance`), which rotates
   continuously as the kombi slides through a corner, so turns sweep instead
   of snapping at vertices. The e2e stamped heading stays a real compass
   bearing, as before.
3. **Camera**: the home camera now opens on the city end of the corridor
   above the sheet, close enough that kombis and stops read instantly at
   360px, with the full corridor one tap away (see `docs/MAP-CAMERA.md`).

None of the fixes changed how the simulation generates positions; the sim
remains byte identical with the server side ETA caller's view of the fleet.
