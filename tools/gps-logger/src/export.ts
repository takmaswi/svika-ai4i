// Export builders. Pure and deterministic so they unit-test cleanly. Each
// journey exports as:
//   - GeoJSON: one LineString per leg (boundaries drawn where mode changes),
//     a Point at every leg boundary (where walking became riding, transfers),
//     a Point per raw ping, and a Point per marked stop.
//   - CSV: one file of raw pings, one of marked points.
//   - a JSON bundle: proposed gps_pings rows plus drop-in seed stops.
//
// The gps_pings table does not exist in packages/db/migrations yet (only public
// .stops does). This bundle is the proposed shape a future migration + seed can
// ingest without reshaping; see README.md. Nothing here is invented network
// data: it is exactly what the phone recorded.

import { pathDistanceMeters } from "./geomath";
import type { Journey, Leg, MarkedPoint, Ping } from "./types";

export const TOOL = "svika-gps-logger";
export const EXPORT_VERSION = "1.0.0";

export interface JourneyExport {
  journey: Journey;
  legs: Leg[];
  pings: Ping[];
  points: MarkedPoint[];
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// --- GeoJSON ---------------------------------------------------------------

type Coord = [number, number]; // [lng, lat], GeoJSON order
type Props = Record<string, string | number | boolean | null>;
interface Feature {
  type: "Feature";
  geometry:
    | { type: "Point"; coordinates: Coord }
    | { type: "LineString"; coordinates: Coord[] };
  properties: Props;
}
export interface FeatureCollection {
  type: "FeatureCollection";
  properties: Props;
  features: Feature[];
}

function coord(p: { lat: number; lng: number }): Coord {
  return [p.lng, p.lat];
}

function pingFeature(ping: Ping): Feature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: coord(ping) },
    properties: {
      feature_type: "ping",
      journey_id: ping.journeyId,
      seq: ping.seq,
      leg_index: ping.legIndex,
      mode: ping.mode,
      route_name: ping.routeName,
      direction: ping.direction,
      recorded_at: toIso(ping.recordedAt),
      accuracy_m: ping.accuracy,
      speed_mps: ping.speed,
      heading_deg: ping.heading,
      altitude_m: ping.altitude,
    },
  };
}

function legFeature(leg: Leg, legPings: Ping[]): Feature | null {
  if (legPings.length < 2) return null;
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: legPings.map(coord) },
    properties: {
      feature_type: "leg",
      journey_id: leg.journeyId,
      leg_index: leg.index,
      mode: leg.mode,
      route_name: leg.routeName,
      direction: leg.direction,
      started_at: toIso(leg.startedAt),
      ended_at: leg.endedAt === null ? null : toIso(leg.endedAt),
      point_count: legPings.length,
      distance_m: Math.round(pathDistanceMeters(legPings)),
    },
  };
}

// A discrete marker at each mode change: where walking became riding, where a
// transfer happened (walking leg wedged between two riding legs), etc.
function boundaryFeature(prev: Leg, leg: Leg, firstPing: Ping | undefined): Feature | null {
  if (!firstPing) return null;
  const isTransfer = prev.mode === "riding" && leg.mode === "walking";
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: coord(firstPing) },
    properties: {
      feature_type: "leg_boundary",
      journey_id: leg.journeyId,
      leg_index: leg.index,
      from_mode: prev.mode,
      to_mode: leg.mode,
      is_transfer_walk: isTransfer,
      route_name: leg.routeName,
      direction: leg.direction,
      at: toIso(leg.startedAt),
    },
  };
}

function markedPointFeature(point: MarkedPoint): Feature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: coord(point) },
    properties: {
      feature_type: "marked_point",
      journey_id: point.journeyId,
      leg_index: point.legIndex,
      mode: point.mode,
      marker_type: point.type,
      name: point.name,
      recorded_at: toIso(point.recordedAt),
      accuracy_m: point.accuracy,
    },
  };
}

function pingsByLeg(pings: Ping[]): Map<number, Ping[]> {
  const map = new Map<number, Ping[]>();
  for (const ping of pings) {
    const bucket = map.get(ping.legIndex);
    if (bucket) bucket.push(ping);
    else map.set(ping.legIndex, [ping]);
  }
  return map;
}

export function buildGeoJson(data: JourneyExport): FeatureCollection {
  const { journey, legs, pings, points } = data;
  const byLeg = pingsByLeg(pings);
  const features: Feature[] = [];

  const sortedLegs = [...legs].sort((a, b) => a.index - b.index);
  for (let i = 0; i < sortedLegs.length; i++) {
    const leg = sortedLegs[i];
    if (!leg) continue;
    const legPings = byLeg.get(leg.index) ?? [];
    const line = legFeature(leg, legPings);
    if (line) features.push(line);
    const prev = sortedLegs[i - 1];
    if (prev) {
      const boundary = boundaryFeature(prev, leg, legPings[0]);
      if (boundary) features.push(boundary);
    }
  }

  for (const ping of pings) features.push(pingFeature(ping));
  for (const point of points) features.push(markedPointFeature(point));

  return {
    type: "FeatureCollection",
    properties: {
      tool: TOOL,
      export_version: EXPORT_VERSION,
      journey_id: journey.id,
      label: journey.label,
      status: journey.status,
      started_at: toIso(journey.startedAt),
      ended_at: journey.endedAt === null ? null : toIso(journey.endedAt),
      leg_count: legs.length,
      ping_count: pings.length,
      marked_point_count: points.length,
      generated_at: toIso(Date.now()),
      note: "Field capture from svika-gps-logger. Place names and geometry are recorded, not invented.",
    },
    features,
  };
}

// --- CSV -------------------------------------------------------------------

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(header: string[], rows: (string | number | null)[][]): string {
  const lines = [header.join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return lines.join("\n") + "\n";
}

export function buildPingsCsv(pings: Ping[]): string {
  return csv(
    [
      "journey_id",
      "seq",
      "leg_index",
      "mode",
      "route_name",
      "direction",
      "recorded_at",
      "lat",
      "lng",
      "accuracy_m",
      "speed_mps",
      "heading_deg",
      "altitude_m",
    ],
    pings.map((p) => [
      p.journeyId,
      p.seq,
      p.legIndex,
      p.mode,
      p.routeName,
      p.direction,
      toIso(p.recordedAt),
      p.lat,
      p.lng,
      p.accuracy,
      p.speed,
      p.heading,
      p.altitude,
    ]),
  );
}

export function buildPointsCsv(points: MarkedPoint[]): string {
  return csv(
    [
      "journey_id",
      "leg_index",
      "mode",
      "marker_type",
      "name",
      "recorded_at",
      "lat",
      "lng",
      "accuracy_m",
    ],
    points.map((p) => [
      p.journeyId,
      p.legIndex,
      p.mode,
      p.type,
      p.name,
      toIso(p.recordedAt),
      p.lat,
      p.lng,
      p.accuracy,
    ]),
  );
}

// --- DB / seed bundle ------------------------------------------------------

export interface GpsPingRow {
  journey_id: string;
  seq: number;
  leg_index: number;
  mode: string;
  route_code: string | null; // free-text route_name is not a coded route yet
  route_name: string | null;
  direction: string | null;
  recorded_at: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  altitude_m: number | null;
  source: "field_logger";
}

// Marked points map onto public.stops (name, name_sn, lat, lng). We emit them in
// the same keyed shape network.json uses so a corridor capture can be pasted
// into the seed. Slug is derived from the name; unnamed points get a stable id.
export interface SeedStop {
  name: string;
  lat: number;
  lng: number;
  marker_type: string;
}

export interface JourneyBundle {
  tool: string;
  export_version: string;
  generated_at: string;
  journey: Journey;
  legs: Leg[];
  gps_pings: GpsPingRow[];
  marked_points: MarkedPoint[];
  seed: { stops: Record<string, SeedStop> };
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function buildBundle(data: JourneyExport): JourneyBundle {
  const { journey, legs, pings, points } = data;

  const gps_pings: GpsPingRow[] = pings.map((p) => ({
    journey_id: p.journeyId,
    seq: p.seq,
    leg_index: p.legIndex,
    mode: p.mode,
    route_code: null,
    route_name: p.routeName,
    direction: p.direction,
    recorded_at: toIso(p.recordedAt),
    lat: p.lat,
    lng: p.lng,
    accuracy_m: p.accuracy,
    speed_mps: p.speed,
    heading_deg: p.heading,
    altitude_m: p.altitude,
    source: "field_logger",
  }));

  const stops: Record<string, SeedStop> = {};
  points.forEach((p, i) => {
    const base = p.name ? `sp_${slugify(p.name)}` : `sp_marked_${p.legIndex}_${i}`;
    let key = base;
    let n = 2;
    while (stops[key]) key = `${base}_${n++}`;
    stops[key] = {
      name: p.name || `Unnamed ${p.type} (${key})`,
      lat: round6(p.lat),
      lng: round6(p.lng),
      marker_type: p.type,
    };
  });

  return {
    tool: TOOL,
    export_version: EXPORT_VERSION,
    generated_at: toIso(Date.now()),
    journey,
    legs: [...legs].sort((a, b) => a.index - b.index),
    gps_pings,
    marked_points: points,
    seed: { stops },
  };
}

// --- Fileset ---------------------------------------------------------------

export interface ExportFile {
  filename: string;
  content: string;
  mime: string;
}

export function exportBasename(journey: Journey): string {
  const stamp = new Date(journey.startedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}`;
  const label = slugify(journey.label) || "journey";
  return `${date}_${label}_${journey.id.slice(-6)}`;
}

export function buildExportFiles(data: JourneyExport): ExportFile[] {
  const base = exportBasename(data.journey);
  return [
    {
      filename: `${base}.geojson`,
      content: JSON.stringify(buildGeoJson(data), null, 2),
      mime: "application/geo+json",
    },
    {
      filename: `${base}.pings.csv`,
      content: buildPingsCsv(data.pings),
      mime: "text/csv",
    },
    {
      filename: `${base}.points.csv`,
      content: buildPointsCsv(data.points),
      mime: "text/csv",
    },
    {
      filename: `${base}.bundle.json`,
      content: JSON.stringify(buildBundle(data), null, 2),
      mime: "application/json",
    },
  ];
}
