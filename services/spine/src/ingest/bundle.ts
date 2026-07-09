// Parses a gps-logger export bundle (tools/gps-logger/src/export.ts,
// JourneyBundle shape) into the fields the ingest needs. Fails fast with a
// named reason instead of half ingesting a malformed file.

import type { RidePing } from "./segments.ts";

export interface BundleJourney {
  sourceRef: string;
  label: string;
  startedAtMs: number;
  endedAtMs: number | null;
}

export interface ParsedBundle {
  journey: BundleJourney;
  pings: BundlePing[];
}

export interface BundlePing extends RidePing {
  legIndex: number;
  recordedAtIso: string;
  speedMps: number | null;
  headingDeg: number | null;
  altitudeM: number | null;
}

function fail(reason: string): never {
  throw new Error(`not a gps-logger bundle: ${reason}`);
}

function numberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function parseBundle(json: unknown): ParsedBundle {
  if (typeof json !== "object" || json === null) fail("not an object");
  const b = json as Record<string, unknown>;
  if (b.tool !== "svika-gps-logger") fail(`tool is ${String(b.tool)}`);

  const j = b.journey as Record<string, unknown> | undefined;
  if (!j || typeof j.id !== "string" || j.id.length === 0) fail("journey.id missing");
  if (typeof j.startedAt !== "number") fail("journey.startedAt missing");

  if (!Array.isArray(b.gps_pings) || b.gps_pings.length === 0) fail("gps_pings empty");
  const pings: BundlePing[] = b.gps_pings.map((raw, i) => {
    const p = raw as Record<string, unknown>;
    if (
      typeof p.seq !== "number" ||
      typeof p.lat !== "number" ||
      typeof p.lng !== "number" ||
      typeof p.mode !== "string" ||
      typeof p.recorded_at !== "string"
    ) {
      fail(`ping ${i} malformed`);
    }
    const recordedAtMs = Date.parse(p.recorded_at);
    if (!Number.isFinite(recordedAtMs)) fail(`ping ${i} has unparseable recorded_at`);
    return {
      seq: p.seq,
      legIndex: typeof p.leg_index === "number" ? p.leg_index : 0,
      mode: p.mode,
      recordedAtIso: p.recorded_at,
      recordedAtMs,
      lat: p.lat,
      lng: p.lng,
      accuracyM: numberOrNull(p.accuracy_m),
      speedMps: numberOrNull(p.speed_mps),
      headingDeg: numberOrNull(p.heading_deg),
      altitudeM: numberOrNull(p.altitude_m),
    };
  });

  return {
    journey: {
      sourceRef: j.id,
      label: typeof j.label === "string" ? j.label : "",
      startedAtMs: j.startedAt,
      endedAtMs: typeof j.endedAt === "number" ? j.endedAt : null,
    },
    pings,
  };
}
