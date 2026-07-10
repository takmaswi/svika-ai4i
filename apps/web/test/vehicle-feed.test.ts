import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { measurePolyline, type LngLat } from "../src/lib/map/geometry";
import {
  profileMetersAt,
  SimulatedVehicleFeed,
  simulatedPositionAt,
  simulatedTravelAt,
  simulationCycleSeconds,
  standardFleet,
  type DirectionProfile,
  type SimulatedVehicle,
  type SimulationConfig,
} from "../src/lib/map/vehicle-feed";

// A straight ~1112 m north-south test road: maths are easy to hand-check.
const road: LngLat[] = [
  [31.05, -17.72],
  [31.05, -17.71],
];
const metrics = measurePolyline(road);
const total = metrics.totalMeters;

// Constant-speed synthetic profiles with deliberately different durations:
// the outbound leg takes 100 s, the return 150 s (its own times, like the
// real corridor where the touting ride and the clean return differ).
const config: SimulationConfig = {
  routeCode: "HEIGHTS-REZENDE",
  metrics,
  profiles: {
    outbound: { durationSeconds: 100, points: [[0, 0], [100, total]] },
    inbound: { durationSeconds: 150, points: [[0, total], [150, 0]] },
  },
  dwellSeconds: 30,
};
const kombi: SimulatedVehicle = { id: "sim-1", phaseSeconds: 0 };

const outMs = 100_000;
const inMs = 150_000;
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

  test("is halfway down the road at half the outbound time", () => {
    const p = simulatedPositionAt(config, kombi, outMs / 2);
    expect(p.lngLat[1]).toBeCloseTo(-17.715, 4);
    expect(p.direction).toBe("outbound");
  });

  test("dwells at the far rank, already turned around", () => {
    const p = simulatedPositionAt(config, kombi, outMs + dwellMs / 2);
    expect(p.lngLat[1]).toBeCloseTo(-17.71, 6);
    expect(p.direction).toBe("inbound");
    expect(p.headingDeg).toBeCloseTo(180, 0); // facing back south
  });

  test("comes back inbound on the return leg's own clock", () => {
    const p = simulatedPositionAt(config, kombi, outMs + dwellMs + inMs / 2);
    expect(p.direction).toBe("inbound");
    expect(p.lngLat[1]).toBeCloseTo(-17.715, 4);
    expect(p.headingDeg).toBeCloseTo(180, 0);
  });

  test("dwells at the near rank at the end of the loop, facing out", () => {
    const p = simulatedPositionAt(config, kombi, outMs + dwellMs + inMs + dwellMs / 2);
    expect(p.direction).toBe("outbound");
    expect(p.lngLat[1]).toBeCloseTo(-17.72, 6);
  });

  test("a full cycle lands back at the start", () => {
    const cycle = simulationCycleSeconds(config) * 1000;
    expect(cycle).toBe(outMs + inMs + 2 * dwellMs);
    const p = simulatedPositionAt(config, kombi, cycle);
    expect(p.lngLat[1]).toBeCloseTo(-17.72, 6);
    expect(p.direction).toBe("outbound");
  });

  test("a phase offset shifts a vehicle around the loop", () => {
    const shifted: SimulatedVehicle = { id: "sim-2", phaseSeconds: 155 };
    const there = simulatedPositionAt(config, shifted, 0);
    const same = simulatedPositionAt(config, kombi, 155_000);
    expect(there.lngLat).toEqual(same.lngLat);
    expect(there.direction).toBe(same.direction);
  });
});

describe("profileMetersAt", () => {
  test("holds still through a recorded stop and never rolls backwards", () => {
    const profile: DirectionProfile = {
      durationSeconds: 30,
      points: [[0, 0], [10, 100], [20, 100], [30, 200]],
    };
    expect(profileMetersAt(profile, 15)).toBeCloseTo(100, 6);
    let last = -Infinity;
    for (let s = 0; s <= 30; s += 0.25) {
      const m = profileMetersAt(profile, s);
      expect(m).toBeGreaterThanOrEqual(last - 1e-9);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(200);
      last = m;
    }
  });

  test("clamps before departure and after arrival", () => {
    const profile: DirectionProfile = { durationSeconds: 10, points: [[0, 0], [10, 50]] };
    expect(profileMetersAt(profile, -5)).toBe(0);
    expect(profileMetersAt(profile, 99)).toBe(50);
  });
});

describe("simulatedTravelAt", () => {
  test("agrees with the drawn position: same phase, same direction", () => {
    for (const elapsed of [0, outMs / 2, outMs + dwellMs / 2, outMs + dwellMs + inMs / 4]) {
      const travel = simulatedTravelAt(config, kombi, elapsed);
      const position = simulatedPositionAt(config, kombi, elapsed);
      expect(travel.direction).toBe(position.direction);
    }
  });

  test("reports metres along the outbound line in both directions", () => {
    expect(simulatedTravelAt(config, kombi, outMs / 2).meters).toBeCloseTo(total / 2, 6);
    const homeward = simulatedTravelAt(config, kombi, outMs + dwellMs + inMs / 2);
    expect(homeward.direction).toBe("inbound");
    expect(homeward.meters).toBeCloseTo(total / 2, 6);
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
    // constant speed on a due-north road: each second moves it further north
    expect(seen[3]![0]!).toBeGreaterThan(seen[0]![0]!);

    stop();
    vi.advanceTimersByTime(3000);
    expect(seen).toHaveLength(4);
  });

  test("sample() answers for any wall clock instant between ticks", () => {
    const feed = new SimulatedVehicleFeed(config, [kombi], { epochMs: 0 });
    const atHalf = feed.sample(outMs / 2);
    expect(atHalf[0]!.lngLat[1]).toBeCloseTo(-17.715, 4);
    // 250 ms later it has moved: the map's per-frame sampling depends on this
    expect(feed.sample(outMs / 2 + 250)[0]!.lngLat[1]).toBeGreaterThan(
      atHalf[0]!.lngLat[1],
    );
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

// --- the real fleet against the real recorded profiles ----------------------
// Mirrors sim-config.ts wiring without the geojson imports: the committed
// sim-profile.json and the real corridor line, sampled across a full cycle.
describe("the four-kombi fleet on the recorded corridor profiles", () => {
  const geoDir = join(__dirname, "../../../packages/db/seed/geo");
  const route = JSON.parse(
    readFileSync(join(geoDir, "corridor.route.geojson"), "utf8"),
  ) as {
    features: {
      properties: { direction: string };
      geometry: { coordinates: LngLat[] };
    }[];
  };
  const outboundLine = route.features.find(
    (f) => f.properties.direction === "outbound",
  )!;
  const realMetrics = measurePolyline(outboundLine.geometry.coordinates);

  const profileJson = JSON.parse(
    readFileSync(join(__dirname, "../src/lib/map/sim-profile.json"), "utf8"),
  ) as {
    baseLineMeters: number;
    directions: { outbound: DirectionProfile; inbound: DirectionProfile };
  };

  const realConfig: SimulationConfig = {
    routeCode: "HEIGHTS-REZENDE",
    metrics: realMetrics,
    profiles: profileJson.directions,
    dwellSeconds: 45,
  };
  const fleet = standardFleet(simulationCycleSeconds(realConfig));

  test("the committed profiles replay the real rides end to end", () => {
    expect(profileJson.baseLineMeters).toBeCloseTo(realMetrics.totalMeters, -1);
    const { outbound, inbound } = profileJson.directions;
    expect(outbound.points[0]![1]).toBe(0);
    expect(outbound.points[outbound.points.length - 1]![1]).toBe(
      profileJson.baseLineMeters,
    );
    expect(inbound.points[0]![1]).toBe(profileJson.baseLineMeters);
    expect(inbound.points[inbound.points.length - 1]![1]).toBe(0);
    // each direction keeps its own recorded clock; they are genuinely different
    expect(outbound.durationSeconds).not.toBe(inbound.durationSeconds);
  });

  test("four kombis, and both directions are always on the road", () => {
    expect(fleet).toHaveLength(4);
    const cycleMs = simulationCycleSeconds(realConfig) * 1000;
    for (let t = 0; t <= cycleMs; t += 15_000) {
      const directions = fleet.map(
        (v) => simulatedTravelAt(realConfig, v, t).direction,
      );
      expect(directions).toContain("outbound");
      expect(directions).toContain("inbound");
    }
  });

  test("every kombi stays on the line and never teleports", () => {
    const cycleMs = simulationCycleSeconds(realConfig) * 1000;
    for (const v of fleet) {
      let last: { meters: number } | null = null;
      for (let t = 0; t <= cycleMs; t += 1_000) {
        const travel = simulatedTravelAt(realConfig, v, t);
        expect(travel.meters).toBeGreaterThanOrEqual(0);
        expect(travel.meters).toBeLessThanOrEqual(realMetrics.totalMeters + 1e-6);
        if (last) {
          // fastest recorded second of the real rides stays under 25 m/s;
          // anything bigger than 40 m in one second would be a jump cut
          expect(Math.abs(travel.meters - last.meters)).toBeLessThan(40);
        }
        last = travel;
      }
    }
  });
});
