// Spine 1, arrival prediction. Two scorers over real segment_times rows:
//
//   baseline:v1  per segment average, corridor average fallback
//   model:v1     per segment per hour average, then the baseline chain
//
// Which one is served is decided ONLY by the committed metrics file that
// pnpm spine:train writes (see train.ts): the model must beat the baseline
// on held out journeys with enough data behind it, or the baseline serves.
// Everything here is pure and side effect free so both scorers and the
// evaluation harness share the exact same prediction code.

import { haversineMeters, type OrderedStop } from "../ingest/segments.ts";

export type Direction = "outbound" | "inbound";

/** One segment_times row, as the engine consumes it. */
export interface SegmentObservation {
  journeyId: string;
  direction: Direction;
  fromStopId: string;
  toStopId: string;
  hourBucket: number;
  durationSeconds: number;
}

export interface SegmentStats {
  /** Distinct journeys behind the averages; the honesty number the UI shows. */
  journeys: number;
  observations: number;
  /** direction|from|to|hour -> mean seconds */
  byHour: Map<string, number>;
  /** direction|from|to -> mean seconds */
  bySegment: Map<string, number>;
  /** Mean seconds across every observation on the route; null with no data. */
  corridorMean: number | null;
}

const hourKey = (d: Direction, from: string, to: string, hour: number) =>
  `${d}|${from}|${to}|${hour}`;
const segmentKey = (d: Direction, from: string, to: string) => `${d}|${from}|${to}`;

function meansOf(sums: Map<string, { total: number; n: number }>): Map<string, number> {
  const means = new Map<string, number>();
  for (const [key, { total, n }] of sums) means.set(key, total / n);
  return means;
}

export function buildSegmentStats(observations: SegmentObservation[]): SegmentStats {
  const byHour = new Map<string, { total: number; n: number }>();
  const bySegment = new Map<string, { total: number; n: number }>();
  const journeys = new Set<string>();
  let total = 0;

  for (const o of observations) {
    journeys.add(o.journeyId);
    total += o.durationSeconds;
    for (const [map, key] of [
      [byHour, hourKey(o.direction, o.fromStopId, o.toStopId, o.hourBucket)],
      [bySegment, segmentKey(o.direction, o.fromStopId, o.toStopId)],
    ] as const) {
      const bucket = map.get(key) ?? { total: 0, n: 0 };
      map.set(key, { total: bucket.total + o.durationSeconds, n: bucket.n + 1 });
    }
  }

  return {
    journeys: journeys.size,
    observations: observations.length,
    byHour: meansOf(byHour),
    bySegment: meansOf(bySegment),
    corridorMean: observations.length > 0 ? total / observations.length : null,
  };
}

export type EngineKind = "baseline:v1" | "model:v1";

export interface SegmentPrediction {
  seconds: number;
  /** True when a matching average existed; false on the corridor fallback. */
  direct: boolean;
}

/**
 * Predict one segment's duration. The model looks up the hour specific
 * average first; both scorers then fall through segment average to corridor
 * average. Null only when the route has no data at all.
 */
export function predictSegment(
  kind: EngineKind,
  stats: SegmentStats,
  direction: Direction,
  fromStopId: string,
  toStopId: string,
  hourBucket: number,
): SegmentPrediction | null {
  if (kind === "model:v1") {
    const byHour = stats.byHour.get(hourKey(direction, fromStopId, toStopId, hourBucket));
    if (byHour !== undefined) return { seconds: byHour, direct: true };
  }
  const bySegment = stats.bySegment.get(segmentKey(direction, fromStopId, toStopId));
  if (bySegment !== undefined) return { seconds: bySegment, direct: true };
  if (stats.corridorMean === null) return null;
  return { seconds: stats.corridorMean, direct: false };
}

export interface EtaEstimate {
  etaSeconds: number;
  source: EngineKind;
  basis: {
    /** Recorded journeys behind the averages. */
    journeys: number;
    /** Path segments covered by a matching average (not corridor fallback). */
    directSegments: number;
    /** Segments between the vehicle's nearest stop and the target. */
    pathSegments: number;
  };
}

export interface EtaInput {
  kind: EngineKind;
  stats: SegmentStats;
  /** Route stops in outbound order; inbound reverses them. */
  stopsOutbound: OrderedStop[];
  direction: Direction;
  targetStopId: string;
  vehicle: { lat: number; lng: number };
  hourBucket: number;
}

/**
 * ETA from a vehicle position to a target stop: snap the vehicle to its
 * nearest stop in travel order, then sum predicted durations for every
 * segment up to the target. Granularity is one stop (about 900 m on the
 * corridor); good enough for "your kombi is N minutes away". Null when the
 * target is not on the route or the route has no recorded data at all.
 */
export function estimateEta(input: EtaInput): EtaEstimate | null {
  const { kind, stats, direction, targetStopId, vehicle, hourBucket } = input;
  const ordered =
    direction === "outbound" ? input.stopsOutbound : [...input.stopsOutbound].reverse();

  const targetIndex = ordered.findIndex((s) => s.id === targetStopId);
  if (targetIndex === -1) return null;

  let vehicleIndex = 0;
  let best = Infinity;
  ordered.forEach((s, i) => {
    const d = haversineMeters(vehicle, s);
    if (d < best) {
      best = d;
      vehicleIndex = i;
    }
  });

  let etaSeconds = 0;
  let directSegments = 0;
  const pathSegments = Math.max(0, targetIndex - vehicleIndex);
  for (let i = vehicleIndex; i < targetIndex; i++) {
    const prediction = predictSegment(
      kind,
      stats,
      direction,
      ordered[i]!.id,
      ordered[i + 1]!.id,
      hourBucket,
    );
    if (!prediction) return null;
    etaSeconds += prediction.seconds;
    if (prediction.direct) directSegments += 1;
  }

  return {
    etaSeconds: Math.round(etaSeconds),
    source: kind,
    basis: { journeys: stats.journeys, directSegments, pathSegments },
  };
}
