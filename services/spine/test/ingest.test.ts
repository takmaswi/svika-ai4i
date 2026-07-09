import { describe, expect, test } from "vitest";
import { parseBundle } from "../src/ingest/bundle";
import { buildIngestPlan } from "../src/ingest/plan";
import {
  deriveSegmentTimes,
  harareHour,
  inferDirection,
  ridingPings,
  snapStopPasses,
  type OrderedStop,
  type RidePing,
} from "../src/ingest/segments";

// Synthetic north-south street at corridor latitude: 0.005 degrees of
// latitude is roughly 555 m, so adjacent stops sit well apart while a 60 m
// snap radius still catches a ping at the stop itself.
const stops: OrderedStop[] = [
  { id: "stop-a", lat: -17.72, lng: 31.046 },
  { id: "stop-b", lat: -17.725, lng: 31.046 },
  { id: "stop-c", lat: -17.73, lng: 31.046 },
  { id: "stop-d", lat: -17.735, lng: 31.046 },
];

const T0 = Date.parse("2026-07-07T10:00:00.000Z");

function ping(overrides: Partial<RidePing> & { seq: number }): RidePing {
  return {
    mode: "riding",
    recordedAtMs: T0 + overrides.seq * 1000,
    lat: -17.72,
    lng: 31.046,
    accuracyM: 5,
    ...overrides,
  };
}

/** A ride down the street: one ping per second, 1 m/s of latitude southwards. */
function rideAlongStreet(seconds: number): RidePing[] {
  const pings: RidePing[] = [];
  for (let s = 0; s <= seconds; s++) {
    pings.push(ping({ seq: s, lat: -17.72 - (s / 111_120) * 1 }));
  }
  return pings;
}

describe("harareHour", () => {
  test("shifts UTC to local Harare time (UTC+2)", () => {
    expect(harareHour(Date.parse("2026-07-07T10:58:54.408Z"))).toBe(12);
  });

  test("wraps past midnight", () => {
    expect(harareHour(Date.parse("2026-07-07T22:30:00.000Z"))).toBe(0);
    expect(harareHour(Date.parse("2026-07-07T23:59:59.000Z"))).toBe(1);
  });
});

describe("ridingPings", () => {
  test("keeps only trusted riding fixes, ordered by seq", () => {
    const trusted = ridingPings([
      ping({ seq: 3 }),
      ping({ seq: 1, mode: "walking" }),
      ping({ seq: 2, accuracyM: 40 }),
      ping({ seq: 0, accuracyM: null }),
      ping({ seq: 4, lat: Number.NaN }),
    ]);
    expect(trusted.map((p) => p.seq)).toEqual([0, 3]);
  });
});

describe("snapStopPasses", () => {
  test("snaps every stop the ride passes, with the closest ping's time", () => {
    // 2225 seconds covers all four stops (each 555 m apart at 1 m/s)
    const passes = snapStopPasses(rideAlongStreet(2225), stops);
    expect(passes.map((p) => p.stopId)).toEqual(["stop-a", "stop-b", "stop-c", "stop-d"]);
    // stop-b sits 555.6 m down the street, so the 556 second ping is nearest
    expect(passes[1]!.atMs).toBe(T0 + 556 * 1000);
    expect(passes[1]!.distanceM).toBeLessThan(2);
  });

  test("leaves out stops the ride never came near", () => {
    const offStreet: OrderedStop[] = [
      ...stops.slice(0, 2),
      { id: "stop-far", lat: -17.7275, lng: 31.05 }, // ~420 m east of the street
      ...stops.slice(2),
    ];
    const passes = snapStopPasses(rideAlongStreet(2225), offStreet);
    expect(passes.map((p) => p.stopId)).toEqual(["stop-a", "stop-b", "stop-c", "stop-d"]);
  });

  test("drops a pass that would run backwards in time", () => {
    // ride reaches stop-b then a stray accurate fix near stop-c happens FIRST
    const pings = [
      ...rideAlongStreet(700),
      ping({ seq: 9999, lat: -17.73, recordedAtMs: T0 - 60_000 }),
    ];
    const passes = snapStopPasses(pings, stops);
    expect(passes.map((p) => p.stopId)).toEqual(["stop-a", "stop-b"]);
  });
});

describe("inferDirection", () => {
  test("forwards ride is outbound", () => {
    expect(inferDirection(rideAlongStreet(2225), stops)).toBe("outbound");
  });

  test("reversed ride is inbound", () => {
    const reversed = rideAlongStreet(2225)
      .reverse()
      .map((p, i) => ({ ...p, seq: i, recordedAtMs: T0 + i * 1000 }));
    expect(inferDirection(reversed, stops)).toBe("inbound");
  });

  test("refuses a ride that never leaves one stop", () => {
    expect(() => inferDirection([ping({ seq: 0 }), ping({ seq: 1 })], stops)).toThrow(
      /ambiguous/,
    );
  });
});

describe("deriveSegmentTimes", () => {
  test("adjacent passes become segments bucketed by departure hour", () => {
    const segments = deriveSegmentTimes([
      { stopId: "stop-a", atMs: T0, distanceM: 1 },
      { stopId: "stop-b", atMs: T0 + 556_000, distanceM: 1 },
      { stopId: "stop-c", atMs: T0 + 1_111_000, distanceM: 1 },
    ]);
    expect(segments).toEqual([
      {
        fromStopId: "stop-a",
        toStopId: "stop-b",
        hourBucket: 12,
        durationSeconds: 556,
      },
      {
        fromStopId: "stop-b",
        toStopId: "stop-c",
        hourBucket: 12,
        durationSeconds: 555,
      },
    ]);
  });

  test("never emits a zero or negative duration", () => {
    const segments = deriveSegmentTimes([
      { stopId: "stop-a", atMs: T0, distanceM: 1 },
      { stopId: "stop-b", atMs: T0, distanceM: 1 },
    ]);
    expect(segments).toEqual([]);
  });
});

describe("parseBundle", () => {
  test("rejects files that are not gps-logger bundles", () => {
    expect(() => parseBundle({ tool: "something-else" })).toThrow(/not a gps-logger bundle/);
    expect(() => parseBundle(null)).toThrow(/not a gps-logger bundle/);
    expect(() =>
      parseBundle({
        tool: "svika-gps-logger",
        journey: { id: "jrn_x", startedAt: T0 },
        gps_pings: [],
      }),
    ).toThrow(/gps_pings empty/);
  });
});

describe("buildIngestPlan idempotency", () => {
  const bundle = parseBundle({
    tool: "svika-gps-logger",
    journey: { id: "jrn_test_1", label: "Test ride", startedAt: T0, endedAt: T0 + 2_300_000 },
    gps_pings: rideAlongStreet(2225).map((p) => ({
      seq: p.seq,
      leg_index: 1,
      mode: p.mode,
      recorded_at: new Date(p.recordedAtMs).toISOString(),
      lat: p.lat,
      lng: p.lng,
      accuracy_m: p.accuracyM,
      speed_mps: 1,
      heading_deg: 180,
      altitude_m: null,
    })),
  });

  test("the same bundle always produces the identical plan", () => {
    const first = buildIngestPlan(bundle, stops, "real_field_ride");
    const second = buildIngestPlan(bundle, stops, "real_field_ride");
    expect(second).toEqual(first);
  });

  test("every row carries a unique natural key", () => {
    const plan = buildIngestPlan(bundle, stops, "real_field_ride");
    const pingKeys = new Set(plan.pings.map((p) => p.seq));
    expect(pingKeys.size).toBe(plan.pings.length);
    const segKeys = new Set(plan.segments.map((s) => `${s.from_stop_id}:${s.to_stop_id}`));
    expect(segKeys.size).toBe(plan.segments.length);
    expect(plan.segments.length).toBe(3);
    expect(plan.journey.direction).toBe("outbound");
  });
});
