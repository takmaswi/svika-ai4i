import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { measurePolyline, type LngLat } from "../src/lib/map/geometry";
import {
  DEFAULT_KOMBI_SPEED_MPS,
  SimulatedVehicleFeed,
  simulatedPositionAt,
  simulatedTravelAt,
  type SimulatedVehicle,
  type SimulationConfig,
} from "../src/lib/map/vehicle-feed";

// A straight ~1112 m north-south test road: maths are easy to hand-check.
const road: LngLat[] = [
  [31.05, -17.72],
  [31.05, -17.71],
];
const metrics = measurePolyline(road);

const config: SimulationConfig = {
  routeCode: "HEIGHTS-REZENDE",
  metrics,
  speedMps: 10,
  dwellSeconds: 30,
};
const kombi: SimulatedVehicle = { id: "sim-1", startMeters: 0, headingOut: true };

const travelMs = (metrics.totalMeters / 10) * 1000;
const dwellMs = 30_000;

describe("simulatedPositionAt", () => {
  test("starts at the start of the line, heading out", () => {
    const p = simulatedPositionAt(config, kombi, 0);
    expect(p.id).toBe("sim-1");
    expect(p.routeCode).toBe("HEIGHTS-REZENDE");
    expect(p.direction).toBe("outbound");
    expect(p.lngLat[1]).toBeCloseTo(-17.72, 6);
    expect(p.headingDeg).toBeCloseTo(0, 0); // due north
  });

  test("is halfway down the road at half the travel time", () => {
    const p = simulatedPositionAt(config, kombi, travelMs / 2);
    expect(p.lngLat[1]).toBeCloseTo(-17.715, 4);
    expect(p.direction).toBe("outbound");
  });

  test("dwells at the far rank, already turned around", () => {
    const p = simulatedPositionAt(config, kombi, travelMs + dwellMs / 2);
    expect(p.lngLat[1]).toBeCloseTo(-17.71, 6);
    expect(p.headingDeg).toBeCloseTo(180, 0); // facing back south
  });

  test("comes back inbound after the dwell", () => {
    const p = simulatedPositionAt(config, kombi, travelMs + dwellMs + travelMs / 2);
    expect(p.direction).toBe("inbound");
    expect(p.lngLat[1]).toBeCloseTo(-17.715, 4);
    expect(p.headingDeg).toBeCloseTo(180, 0);
  });

  test("a full cycle lands back at the start", () => {
    const cycle = 2 * (travelMs + dwellMs);
    const p = simulatedPositionAt(config, kombi, cycle);
    expect(p.lngLat[1]).toBeCloseTo(-17.72, 6);
    expect(p.direction).toBe("outbound");
  });

  test("a vehicle can start mid-route and heading home", () => {
    const v: SimulatedVehicle = {
      id: "sim-2",
      startMeters: metrics.totalMeters / 2,
      headingOut: false,
    };
    const p = simulatedPositionAt(config, v, 0);
    expect(p.direction).toBe("inbound");
    expect(p.lngLat[1]).toBeCloseTo(-17.715, 4);
  });

  test("ships a field-derived default speed", () => {
    // 13 466 m in 27 riding minutes, from corridor.summary.json
    expect(DEFAULT_KOMBI_SPEED_MPS).toBeCloseTo(13466 / (27 * 60), 2);
  });
});

describe("simulatedTravelAt", () => {
  test("agrees with the drawn position: same phase, same metres", () => {
    for (const elapsed of [0, travelMs / 2, travelMs + dwellMs / 2, travelMs + dwellMs + travelMs / 4]) {
      const travel = simulatedTravelAt(config, kombi, elapsed);
      const position = simulatedPositionAt(config, kombi, elapsed);
      expect(travel.direction).toBe(position.direction);
    }
  });

  test("reports metres along the outbound line in both directions", () => {
    expect(simulatedTravelAt(config, kombi, travelMs / 2).meters).toBeCloseTo(
      metrics.totalMeters / 2,
      6,
    );
    const homeward = simulatedTravelAt(config, kombi, travelMs + dwellMs + travelMs / 2);
    expect(homeward.direction).toBe("inbound");
    expect(homeward.meters).toBeCloseTo(metrics.totalMeters / 2, 6);
  });

  test("two feeds sharing an epoch agree no matter when each started", () => {
    // this is what keeps the server's ETA and the map marker on the same
    // kombi: position is a function of wall clock time, not of mount time
    let clock = 50_000;
    const feedA = new SimulatedVehicleFeed(config, [kombi], { now: () => clock, epochMs: 0 });
    clock = 80_000; // the second feed is created 30 s later
    const feedB = new SimulatedVehicleFeed(config, [kombi], { now: () => clock, epochMs: 0 });
    let a: number[] = [];
    let b: number[] = [];
    feedA.subscribe((p) => {
      a = p.map((x) => x.lngLat[1]);
    })();
    feedB.subscribe((p) => {
      b = p.map((x) => x.lngLat[1]);
    })();
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
  });
});

describe("SimulatedVehicleFeed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("emits immediately, then on every tick, until unsubscribed", () => {
    const feed = new SimulatedVehicleFeed(config, [kombi], { tickMs: 1000 });
    const seen: number[][] = [];
    const stop = feed.subscribe((positions) => {
      seen.push(positions.map((p) => p.lngLat[1]));
    });

    expect(seen).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(seen).toHaveLength(4);
    // 10 m/s on a due-north road: each second moves it further north
    expect(seen[3]![0]!).toBeGreaterThan(seen[0]![0]!);

    stop();
    vi.advanceTimersByTime(3000);
    expect(seen).toHaveLength(4);
  });

  test("two subscribers each get their own immediate emit", () => {
    const feed = new SimulatedVehicleFeed(config, [kombi], { tickMs: 1000 });
    const a = vi.fn();
    const b = vi.fn();
    const stopA = feed.subscribe(a);
    const stopB = feed.subscribe(b);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    stopA();
    stopB();
  });
});
