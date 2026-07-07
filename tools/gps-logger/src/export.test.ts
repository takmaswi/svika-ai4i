import { describe, it, expect } from "vitest";
import {
  buildGeoJson,
  buildPingsCsv,
  buildPointsCsv,
  buildBundle,
  buildExportFiles,
  slugify,
} from "./export";
import type { Journey, Leg, MarkedPoint, Ping, Mode } from "./types";

const journey: Journey = {
  id: "jrn_123456_abcdef",
  label: "Heights corridor 07:15",
  status: "ended",
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_600_000,
  createdAt: 1_700_000_000_000,
  currentLegIndex: 2,
  currentMode: "walking",
  notes: "",
};

const legs: Leg[] = [
  { journeyId: journey.id, index: 0, mode: "walking", routeName: null, direction: null, startedAt: 0, endedAt: 100 },
  { journeyId: journey.id, index: 1, mode: "riding", routeName: "Heights to Rezende", direction: "outbound", startedAt: 100, endedAt: 200 },
  { journeyId: journey.id, index: 2, mode: "walking", routeName: null, direction: null, startedAt: 200, endedAt: 300 },
];

function ping(seq: number, legIndex: number, mode: Mode, lat: number, lng: number, route: string | null = null): Ping {
  return {
    journeyId: journey.id,
    seq,
    legIndex,
    mode,
    routeName: route,
    direction: route ? "outbound" : null,
    recordedAt: 1_700_000_000_000 + seq * 1000,
    lat,
    lng,
    accuracy: 5,
    speed: 3,
    heading: 90,
    altitude: 1400,
  };
}

const pings: Ping[] = [
  ping(0, 0, "walking", -17.7498, 31.0425),
  ping(1, 0, "walking", -17.7500, 31.0430),
  ping(2, 1, "riding", -17.7600, 31.0450, "Heights to Rezende"),
  ping(3, 1, "riding", -17.7700, 31.0470, "Heights to Rezende"),
  ping(4, 2, "walking", -17.7800, 31.0480),
  ping(5, 2, "walking", -17.7810, 31.0485),
];

const points: MarkedPoint[] = [
  { journeyId: journey.id, legIndex: 1, mode: "riding", type: "rank", name: "Rezende Rank", recordedAt: 1_700_000_150_000, lat: -17.7650, lng: 31.046, accuracy: 8 },
  { journeyId: journey.id, legIndex: 2, mode: "walking", type: "dropoff", name: "", recordedAt: 1_700_000_250_000, lat: -17.7805, lng: 31.0482, accuracy: 8 },
];

const data = { journey, legs, pings, points };

describe("buildGeoJson", () => {
  const fc = buildGeoJson(data);
  const byType = (t: string) => fc.features.filter((f) => f.properties.feature_type === t);

  it("emits one LineString per leg with >= 2 pings", () => {
    expect(byType("leg")).toHaveLength(3);
    expect(byType("leg").every((f) => f.geometry.type === "LineString")).toBe(true);
  });

  it("marks a boundary at every mode change but not before leg 0", () => {
    const boundaries = byType("leg_boundary");
    expect(boundaries).toHaveLength(2);
    expect(boundaries.map((b) => b.properties.leg_index).sort()).toEqual([1, 2]);
  });

  it("flags a walking leg between two rides as a transfer walk", () => {
    const b2 = byType("leg_boundary").find((b) => b.properties.leg_index === 2);
    expect(b2?.properties.from_mode).toBe("riding");
    expect(b2?.properties.to_mode).toBe("walking");
    expect(b2?.properties.is_transfer_walk).toBe(true);
  });

  it("emits a point per ping and per marked point in [lng, lat] order", () => {
    expect(byType("ping")).toHaveLength(6);
    expect(byType("marked_point")).toHaveLength(2);
    const first = byType("ping")[0]!;
    expect(first.geometry.coordinates).toEqual([31.0425, -17.7498]);
  });
});

describe("CSV", () => {
  it("writes a header and one row per ping", () => {
    const lines = buildPingsCsv(pings).trim().split("\n");
    expect(lines[0]).toContain("journey_id,seq,leg_index,mode");
    expect(lines).toHaveLength(1 + pings.length);
  });

  it("quotes fields that contain a comma", () => {
    const withComma: MarkedPoint = { ...points[0]!, name: "Rank, west side" };
    const csv = buildPointsCsv([withComma]);
    expect(csv).toContain('"Rank, west side"');
  });
});

describe("buildBundle", () => {
  const bundle = buildBundle(data);

  it("produces one gps_pings row per ping tagged as field_logger", () => {
    expect(bundle.gps_pings).toHaveLength(6);
    expect(bundle.gps_pings.every((r) => r.source === "field_logger")).toBe(true);
    expect(bundle.gps_pings[2]!.route_name).toBe("Heights to Rezende");
    expect(bundle.gps_pings[2]!.route_code).toBeNull();
  });

  it("maps marked points to seed stops keyed by a name slug", () => {
    expect(bundle.seed.stops).toHaveProperty("sp_rezende_rank");
    expect(bundle.seed.stops.sp_rezende_rank!.name).toBe("Rezende Rank");
  });

  it("gives unnamed points a stable fallback key", () => {
    const unnamedKey = Object.keys(bundle.seed.stops).find((k) => k.startsWith("sp_marked_"));
    expect(unnamedKey).toBeDefined();
  });
});

describe("buildExportFiles", () => {
  it("returns the four expected artefacts", () => {
    const files = buildExportFiles(data).map((f) => f.filename);
    expect(files.some((f) => f.endsWith(".geojson"))).toBe(true);
    expect(files.some((f) => f.endsWith(".pings.csv"))).toBe(true);
    expect(files.some((f) => f.endsWith(".points.csv"))).toBe(true);
    expect(files.some((f) => f.endsWith(".bundle.json"))).toBe(true);
  });
});

describe("slugify", () => {
  it("lowercases and underscores", () => {
    expect(slugify("4th Street Bus Terminal")).toBe("4th_street_bus_terminal");
  });
});
