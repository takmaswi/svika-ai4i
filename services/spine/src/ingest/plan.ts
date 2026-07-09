// Turns a parsed bundle plus the route's seeded stop sequence into the exact
// rows the database will hold. Pure and deterministic: the same bundle always
// produces the same plan, and every row carries a natural key (journey
// source_ref, ping seq, stop pair), which is what makes the ingest idempotent.

import type { ParsedBundle } from "./bundle.ts";
import {
  deriveSegmentTimes,
  inferDirection,
  ridingPings,
  snapStopPasses,
  type OrderedStop,
  type StopPass,
} from "./segments.ts";

export type RideSource = "real_field_ride" | "synthetic" | "demo_sim";

export interface JourneyRow {
  source_ref: string;
  label: string;
  direction: "outbound" | "inbound";
  started_at: string;
  ended_at: string | null;
  source: RideSource;
}

export interface PingRow {
  seq: number;
  leg_index: number;
  mode: string;
  recorded_at: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  altitude_m: number | null;
  source: RideSource;
}

export interface SegmentRow {
  direction: "outbound" | "inbound";
  from_stop_id: string;
  to_stop_id: string;
  hour_bucket: number;
  duration_seconds: number;
  source: RideSource;
}

export interface IngestPlan {
  journey: JourneyRow;
  pings: PingRow[];
  segments: SegmentRow[];
  passes: StopPass[];
}

export function buildIngestPlan(
  bundle: ParsedBundle,
  stopsOutbound: OrderedStop[],
  source: RideSource,
): IngestPlan {
  const riding = ridingPings(bundle.pings);
  const direction = inferDirection(riding, stopsOutbound);
  const orderedStops =
    direction === "outbound" ? stopsOutbound : [...stopsOutbound].reverse();
  const passes = snapStopPasses(riding, orderedStops);
  const segments = deriveSegmentTimes(passes).map((s) => ({
    direction,
    from_stop_id: s.fromStopId,
    to_stop_id: s.toStopId,
    hour_bucket: s.hourBucket,
    duration_seconds: s.durationSeconds,
    source,
  }));

  const pings = [...bundle.pings]
    .sort((a, b) => a.seq - b.seq)
    .map((p) => ({
      seq: p.seq,
      leg_index: p.legIndex,
      mode: p.mode,
      recorded_at: p.recordedAtIso,
      lat: p.lat,
      lng: p.lng,
      accuracy_m: p.accuracyM,
      speed_mps: p.speedMps,
      heading_deg: p.headingDeg,
      altitude_m: p.altitudeM,
      source,
    }));

  return {
    journey: {
      source_ref: bundle.journey.sourceRef,
      label: bundle.journey.label,
      direction,
      started_at: new Date(bundle.journey.startedAtMs).toISOString(),
      ended_at:
        bundle.journey.endedAtMs === null
          ? null
          : new Date(bundle.journey.endedAtMs).toISOString(),
      source,
    },
    pings,
    segments,
    passes,
  };
}
