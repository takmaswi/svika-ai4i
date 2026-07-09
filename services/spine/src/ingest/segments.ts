// Pure derivation logic for the ride data pipeline: snap a recorded ride's
// riding pings to the seeded stops of its route and turn adjacent stop passes
// into segment_times rows. Everything here is deterministic and side effect
// free so the ingest is unit testable without a database.
//
// The snap radius is measured, not guessed: on the two real 2026-07-07
// corridor rides every genuinely passed stop had a riding ping within 31 m,
// while stops on road sections a ride never touched were 180 m to 2.7 km
// away. 60 m separates the two populations with a wide margin either side.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface OrderedStop extends LatLng {
  id: string;
}

export interface RidePing extends LatLng {
  seq: number;
  mode: string;
  recordedAtMs: number;
  accuracyM: number | null;
}

export interface StopPass {
  stopId: string;
  atMs: number;
  distanceM: number;
}

export interface SegmentTime {
  fromStopId: string;
  toStopId: string;
  hourBucket: number;
  durationSeconds: number;
}

/** Same accuracy floor the corridor geometry derivation uses (derive.mjs). */
export const ACCURACY_MAX_M = 25;
export const SNAP_MAX_M = 60;

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const HARARE_UTC_OFFSET_HOURS = 2; // no daylight saving in Zimbabwe

/** Local Harare hour (0-23) for a UTC timestamp in milliseconds. */
export function harareHour(utcMs: number): number {
  const hour = Math.floor(utcMs / 3_600_000) + HARARE_UTC_OFFSET_HOURS;
  return ((hour % 24) + 24) % 24;
}

/** Riding pings the derivation trusts: riding mode, finite coords, accurate fix. */
export function ridingPings(pings: RidePing[]): RidePing[] {
  return pings
    .filter((p) => p.mode === "riding")
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .filter((p) => p.accuracyM === null || p.accuracyM <= ACCURACY_MAX_M)
    .sort((a, b) => a.seq - b.seq);
}

function nearestStopIndex(p: LatLng, stops: OrderedStop[]): number {
  let best = Infinity;
  let index = 0;
  stops.forEach((s, i) => {
    const d = haversineMeters(p, s);
    if (d < best) {
      best = d;
      index = i;
    }
  });
  return index;
}

/**
 * Which way the ride ran, from geometry alone. The logger's route and
 * direction fields are free text typed on a moving kombi, so they are never
 * trusted; instead the first and last trusted riding pings are matched to
 * their nearest stops in the outbound ordering.
 */
export function inferDirection(
  riding: RidePing[],
  stopsOutbound: OrderedStop[],
): "outbound" | "inbound" {
  if (riding.length < 2) {
    throw new Error("cannot infer direction from fewer than two riding pings");
  }
  const first = nearestStopIndex(riding[0]!, stopsOutbound);
  const last = nearestStopIndex(riding[riding.length - 1]!, stopsOutbound);
  if (first === last) {
    throw new Error("ride starts and ends nearest the same stop; direction is ambiguous");
  }
  return first < last ? "outbound" : "inbound";
}

/**
 * The moment the ride passed each stop, in stop order. A stop counts as
 * passed only when some riding ping comes within maxM of it (the closest
 * ping's time is the pass time). Stops the ride never came near are simply
 * absent, and passes that would run backwards in time against stop order are
 * dropped, so a noisy fix can never produce a negative segment.
 */
export function snapStopPasses(
  riding: RidePing[],
  orderedStops: OrderedStop[],
  maxM: number = SNAP_MAX_M,
): StopPass[] {
  const passes: StopPass[] = [];
  for (const stop of orderedStops) {
    let best: RidePing | null = null;
    let bestD = Infinity;
    for (const p of riding) {
      const d = haversineMeters(p, stop);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best || bestD > maxM) continue;
    const prev = passes[passes.length - 1];
    if (prev && best.recordedAtMs <= prev.atMs) continue;
    passes.push({ stopId: stop.id, atMs: best.recordedAtMs, distanceM: bestD });
  }
  return passes;
}

/** Adjacent stop passes become segment rows, bucketed by departure hour. */
export function deriveSegmentTimes(passes: StopPass[]): SegmentTime[] {
  const segments: SegmentTime[] = [];
  for (let i = 1; i < passes.length; i++) {
    const from = passes[i - 1]!;
    const to = passes[i]!;
    const durationSeconds = Math.round((to.atMs - from.atMs) / 1000);
    if (durationSeconds <= 0) continue;
    segments.push({
      fromStopId: from.stopId,
      toStopId: to.stopId,
      hourBucket: harareHour(from.atMs),
      durationSeconds,
    });
  }
  return segments;
}
