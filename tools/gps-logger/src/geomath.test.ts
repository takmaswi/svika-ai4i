import { describe, it, expect } from "vitest";
import {
  haversineMeters,
  pathDistanceMeters,
  speedMps,
  formatDuration,
  formatKmh,
  mpsToKmh,
} from "./geomath";
import type { Fix, Ping } from "./types";

describe("haversineMeters", () => {
  it("returns zero for the same point", () => {
    expect(haversineMeters(-17.8, 31.05, -17.8, 31.05)).toBe(0);
  });

  it("measures one degree of longitude at the equator as ~111.2 km", () => {
    const d = haversineMeters(0, 0, 0, 1);
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });
});

describe("pathDistanceMeters", () => {
  const ping = (lat: number, lng: number): Ping => ({
    journeyId: "j",
    seq: 0,
    legIndex: 0,
    mode: "walking",
    routeName: null,
    direction: null,
    recordedAt: 0,
    lat,
    lng,
    accuracy: null,
    speed: null,
    heading: null,
    altitude: null,
  });

  it("sums the segments of an ordered path", () => {
    const pings = [ping(0, 0), ping(0, 1), ping(0, 2)];
    const total = pathDistanceMeters(pings);
    expect(total).toBeCloseTo(2 * haversineMeters(0, 0, 0, 1), 3);
  });

  it("is zero for a single point", () => {
    expect(pathDistanceMeters([ping(0, 0)])).toBe(0);
  });
});

describe("speedMps", () => {
  const fix = (timestamp: number, lat: number, lng: number, speed: number | null): Fix => ({
    timestamp,
    lat,
    lng,
    speed,
    accuracy: null,
    heading: null,
    altitude: null,
  });

  it("prefers the GPS-reported speed when present", () => {
    expect(speedMps(fix(1000, 0, 0, 4.2), null)).toBe(4.2);
  });

  it("derives speed from the previous fix when GPS speed is missing", () => {
    const prev = fix(0, 0, 0, null);
    const cur = fix(1000, 0, 0.001, null); // ~111 m in 1 s
    const s = speedMps(cur, prev);
    expect(s).not.toBeNull();
    expect(s!).toBeGreaterThan(100);
  });

  it("returns null with no previous fix and no GPS speed", () => {
    expect(speedMps(fix(0, 0, 0, null), null)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats durations under and over an hour", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(65_000)).toBe("01:05");
    expect(formatDuration(3_665_000)).toBe("1:01:05");
  });

  it("converts and formats speed", () => {
    expect(mpsToKmh(10)).toBeCloseTo(36);
    expect(formatKmh(null)).toBe("--");
    expect(formatKmh(10)).toBe("36 km/h");
  });
});
