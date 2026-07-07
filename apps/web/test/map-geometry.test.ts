import { describe, expect, test } from "vitest";
import {
  headingAtDistance,
  measurePolyline,
  pointAtDistance,
  type LngLat,
} from "../src/lib/map/geometry";

// 0.001 deg of latitude is ~111.19 m everywhere on the sphere.
const LAT_STEP_M = 111.19;
const HARARE_LAT = -17.72;

const north: LngLat[] = [
  [31.05, HARARE_LAT],
  [31.05, HARARE_LAT + 0.001],
];
const east: LngLat[] = [
  [31.05, HARARE_LAT],
  [31.051, HARARE_LAT],
];

describe("measurePolyline", () => {
  test("measures a due-north step as ~111 m", () => {
    const m = measurePolyline(north);
    expect(m.totalMeters).toBeGreaterThan(LAT_STEP_M - 0.5);
    expect(m.totalMeters).toBeLessThan(LAT_STEP_M + 0.5);
    expect(m.cumulative).toHaveLength(2);
    expect(m.cumulative[0]).toBe(0);
    expect(m.cumulative[1]).toBeCloseTo(m.totalMeters, 6);
  });

  test("shrinks a due-east step by cos(latitude)", () => {
    const m = measurePolyline(east);
    const expected = LAT_STEP_M * Math.cos((HARARE_LAT * Math.PI) / 180);
    expect(Math.abs(m.totalMeters - expected)).toBeLessThan(0.5);
  });

  test("rejects a polyline with fewer than two points", () => {
    expect(() => measurePolyline([[31.05, -17.72]])).toThrow(/two/i);
  });
});

describe("pointAtDistance", () => {
  const line: LngLat[] = [
    [31.05, -17.72],
    [31.05, -17.719], // north ~111 m
    [31.051, -17.719], // then east ~106 m
  ];
  const m = measurePolyline(line);

  test("returns the first point at 0 and clamps below", () => {
    expect(pointAtDistance(m, 0)).toEqual(line[0]);
    expect(pointAtDistance(m, -50)).toEqual(line[0]);
  });

  test("returns the last point at the total length and clamps beyond", () => {
    expect(pointAtDistance(m, m.totalMeters)).toEqual(line[2]);
    expect(pointAtDistance(m, m.totalMeters + 500)).toEqual(line[2]);
  });

  test("interpolates linearly inside a segment", () => {
    const half = pointAtDistance(m, m.cumulative[1]! / 2);
    expect(half[0]).toBeCloseTo(31.05, 9);
    expect(half[1]).toBeCloseTo(-17.7195, 5);
  });

  test("lands on an interior vertex exactly", () => {
    expect(pointAtDistance(m, m.cumulative[1]!)).toEqual(line[1]);
  });
});

describe("headingAtDistance", () => {
  const line: LngLat[] = [
    [31.05, -17.72],
    [31.05, -17.719], // north
    [31.051, -17.719], // east
    [31.051, -17.72], // south
    [31.05, -17.72], // west
  ];
  const m = measurePolyline(line);

  test("reads 0 due north, 90 east, 180 south, 270 west", () => {
    const mid = (i: number) => (m.cumulative[i]! + m.cumulative[i + 1]!) / 2;
    expect(headingAtDistance(m, mid(0))).toBeCloseTo(0, 0);
    expect(headingAtDistance(m, mid(1))).toBeCloseTo(90, 0);
    expect(headingAtDistance(m, mid(2))).toBeCloseTo(180, 0);
    expect(headingAtDistance(m, mid(3))).toBeCloseTo(270, 0);
  });

  test("uses the last segment's heading at and beyond the end", () => {
    expect(headingAtDistance(m, m.totalMeters)).toBeCloseTo(270, 0);
    expect(headingAtDistance(m, m.totalMeters + 100)).toBeCloseTo(270, 0);
  });
});

describe("lerpLngLat", () => {
  test("interpolates between two points", async () => {
    const { lerpLngLat } = await import("../src/lib/map/geometry");
    const mid = lerpLngLat([31, -17.7], [31.002, -17.7], 0.5);
    expect(mid[0]).toBeCloseTo(31.001, 9);
    expect(mid[1]).toBeCloseTo(-17.7, 9);
    expect(lerpLngLat([31, -17.7], [31.002, -17.7], 0)).toEqual([31, -17.7]);
    expect(lerpLngLat([31, -17.7], [31.002, -17.7], 1)).toEqual([31.002, -17.7]);
  });
});

describe("lerpHeading", () => {
  test("takes the short way around the compass", async () => {
    const { lerpHeading } = await import("../src/lib/map/geometry");
    expect(lerpHeading(350, 10, 0.5)).toBeCloseTo(0, 5);
    expect(lerpHeading(10, 350, 0.5)).toBeCloseTo(0, 5);
    expect(lerpHeading(0, 180, 0.5)).toBeCloseTo(90, 5);
    expect(lerpHeading(90, 90, 0.7)).toBeCloseTo(90, 5);
    expect(lerpHeading(350, 10, 1)).toBeCloseTo(10, 5);
  });
});
