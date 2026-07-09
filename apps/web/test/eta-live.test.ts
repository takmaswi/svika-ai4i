import { describe, expect, test, vi } from "vitest";
import { MockEtaProvider } from "../src/lib/map/eta";
import {
  SpineEtaProvider,
  distanceAlongLine,
  pickApproachingVehicle,
  tripDirection,
  type CorridorContext,
  type SpineEtaDeps,
} from "../src/lib/map/eta-live";
import { measurePolyline, type LngLat } from "../src/lib/map/geometry";
import type { SimulatedTravel, SimulationConfig } from "../src/lib/map/vehicle-feed";

// A straight ~3335 m north-south test road with four stops on its vertices.
const road: LngLat[] = [
  [31.05, -17.72],
  [31.05, -17.73],
  [31.05, -17.74],
  [31.05, -17.75],
];
const metrics = measurePolyline(road);
const stopIds = ["stop-a", "stop-b", "stop-c", "stop-d"];

const corridor: CorridorContext = {
  routeCode: "TEST-01",
  orderedStopIds: stopIds,
  metrics,
  stopLngLats: road,
};

const simConfig: SimulationConfig = {
  routeCode: "TEST-01",
  metrics,
  speedMps: 10,
  dwellSeconds: 0,
};

describe("tripDirection", () => {
  test("follows the outbound stop order", () => {
    expect(tripDirection(stopIds, "stop-a", "stop-c")).toBe("outbound");
    expect(tripDirection(stopIds, "stop-d", "stop-b")).toBe("inbound");
  });

  test("is null off the corridor, so the mock twin serves", () => {
    expect(tripDirection(stopIds, "stop-x", "stop-c")).toBeNull();
    expect(tripDirection(stopIds, "stop-a", "stop-a")).toBeNull();
  });
});

describe("distanceAlongLine", () => {
  test("a stop on a vertex lands on its cumulative distance", () => {
    expect(distanceAlongLine(metrics, road[0]!)).toBe(0);
    expect(distanceAlongLine(metrics, road[2]!)).toBeCloseTo(metrics.cumulative[2]!, 6);
  });
});

describe("pickApproachingVehicle", () => {
  const target = metrics.cumulative[2]!; // stop-c

  test("outbound: the vehicle behind the stop and nearest to it wins", () => {
    const travels: SimulatedTravel[] = [
      { direction: "outbound", meters: 100 },
      { direction: "outbound", meters: target - 50 },
      { direction: "inbound", meters: target - 10 },
    ];
    expect(pickApproachingVehicle(travels, "outbound", target)?.meters).toBe(target - 50);
  });

  test("inbound travels the line backwards", () => {
    const travels: SimulatedTravel[] = [
      { direction: "inbound", meters: target + 400 },
      { direction: "inbound", meters: target + 90 },
    ];
    expect(pickApproachingVehicle(travels, "inbound", target)?.meters).toBe(target + 90);
  });

  test("null when every same way vehicle has already passed the stop", () => {
    const travels: SimulatedTravel[] = [{ direction: "outbound", meters: target + 500 }];
    expect(pickApproachingVehicle(travels, "outbound", target)).toBeNull();
  });
});

function providerWith(overrides: Partial<SpineEtaDeps> = {}) {
  const fetchFn = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      etaSeconds: 300,
      source: "baseline:v1",
      basis: { journeys: 2, directSegments: 2, pathSegments: 2 },
    }),
  })) as unknown as typeof fetch;
  const deps: SpineEtaDeps = {
    baseUrl: "http://spine.test",
    corridor,
    simConfig,
    // one kombi that just left stop-a, heading out
    vehicles: [{ id: "sim-1", startMeters: 0, headingOut: true }],
    epochMs: 0,
    fallback: new MockEtaProvider(() => 1_700_000_000_000),
    fetchFn,
    now: () => 10_000, // 10 s in: 100 m along at 10 m/s
    ...overrides,
  };
  return { provider: new SpineEtaProvider(deps), fetchFn: deps.fetchFn as ReturnType<typeof vi.fn> };
}

describe("SpineEtaProvider", () => {
  test("asks the spine and passes the ride count through", async () => {
    const { provider, fetchFn } = providerWith();
    const eta = await provider.estimate("stop-c", "stop-d");
    expect(eta).toEqual({ minutes: 5, isMock: false, rides: 2 });
    const url = String(fetchFn.mock.calls[0]![0]);
    expect(url).toContain("route=TEST-01");
    expect(url).toContain("direction=outbound");
    expect(url).toContain("target=stop-c");
  });

  test("never renders a zero: a due kombi reads one minute", async () => {
    const { provider } = providerWith({
      fetchFn: vi.fn(async () => ({
        ok: true,
        json: async () => ({ etaSeconds: 10, basis: { journeys: 2 } }),
      })) as unknown as typeof fetch,
    });
    const eta = await provider.estimate("stop-c", "stop-d");
    expect(eta.minutes).toBe(1);
  });

  test("falls back to the mock twin when the spine is down", async () => {
    const { provider } = providerWith({
      fetchFn: vi.fn(async () => {
        throw new Error("connection refused");
      }) as unknown as typeof fetch,
    });
    const eta = await provider.estimate("stop-c", "stop-d");
    expect(eta.isMock).toBe(true);
  });

  test("falls back on a non 200 answer", async () => {
    const { provider } = providerWith({
      fetchFn: vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch,
    });
    const eta = await provider.estimate("stop-c", "stop-d");
    expect(eta.isMock).toBe(true);
  });

  test("falls back for a trip off the corridor without calling the spine", async () => {
    const { provider, fetchFn } = providerWith();
    const eta = await provider.estimate("stop-x", "stop-y");
    expect(eta.isMock).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("falls back when no kombi is approaching a mid corridor stop", async () => {
    const { provider, fetchFn } = providerWith({
      // 200 s at 10 m/s: the only kombi is 2000 m in, past stop-b (1111 m)
      now: () => 200_000,
    });
    const eta = await provider.estimate("stop-b", "stop-c");
    expect(eta.isMock).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("boarding at the rank: the kombi finishing the opposite leg is the wait", async () => {
    const { provider, fetchFn } = providerWith({
      // 400 s in the kombi is on its way back, 2670 m from the start
      now: () => 400_000,
    });
    const eta = await provider.estimate("stop-a", "stop-d");
    expect(eta.isMock).toBe(false);
    const url = String(fetchFn.mock.calls[0]![0]);
    expect(url).toContain("direction=inbound");
    expect(url).toContain("target=stop-a");
  });

  test("falls back when the wiring is off: stop ids and points misaligned", async () => {
    const { provider, fetchFn } = providerWith({
      corridor: { ...corridor, orderedStopIds: ["stop-a", "stop-b"] },
    });
    const eta = await provider.estimate("stop-a", "stop-b");
    expect(eta.isMock).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
