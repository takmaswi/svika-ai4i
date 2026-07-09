import { describe, expect, test } from "vitest";
import {
  buildSegmentStats,
  estimateEta,
  predictSegment,
  type Direction,
  type SegmentObservation,
} from "../src/eta/engine";
import type { OrderedStop } from "../src/ingest/segments";

// Same synthetic north-south street the ingest tests ride: stops every
// 0.005 degrees of latitude, roughly 555 m apart.
const stops: OrderedStop[] = [
  { id: "stop-a", lat: -17.72, lng: 31.046 },
  { id: "stop-b", lat: -17.725, lng: 31.046 },
  { id: "stop-c", lat: -17.73, lng: 31.046 },
  { id: "stop-d", lat: -17.735, lng: 31.046 },
];

function obs(overrides: Partial<SegmentObservation>): SegmentObservation {
  return {
    journeyId: "jrn-1",
    direction: "outbound" as Direction,
    fromStopId: "stop-a",
    toStopId: "stop-b",
    hourBucket: 12,
    durationSeconds: 100,
    ...overrides,
  };
}

describe("buildSegmentStats", () => {
  test("averages per segment, per hour, and corridor wide", () => {
    const stats = buildSegmentStats([
      obs({ durationSeconds: 100, hourBucket: 12 }),
      obs({ durationSeconds: 200, hourBucket: 12, journeyId: "jrn-2" }),
      obs({ durationSeconds: 600, hourBucket: 17, journeyId: "jrn-3" }),
    ]);
    expect(stats.journeys).toBe(3);
    expect(stats.observations).toBe(3);
    expect(stats.byHour.get("outbound|stop-a|stop-b|12")).toBe(150);
    expect(stats.byHour.get("outbound|stop-a|stop-b|17")).toBe(600);
    expect(stats.bySegment.get("outbound|stop-a|stop-b")).toBe(300);
    expect(stats.corridorMean).toBe(300);
  });

  test("no data means no corridor mean", () => {
    expect(buildSegmentStats([]).corridorMean).toBeNull();
  });
});

describe("predictSegment", () => {
  const stats = buildSegmentStats([
    obs({ durationSeconds: 100, hourBucket: 12 }),
    obs({ durationSeconds: 600, hourBucket: 17, journeyId: "jrn-2" }),
    obs({ fromStopId: "stop-b", toStopId: "stop-c", durationSeconds: 200, journeyId: "jrn-3" }),
  ]);

  test("the model prefers the hour specific average", () => {
    expect(predictSegment("model:v1", stats, "outbound", "stop-a", "stop-b", 17)).toEqual({
      seconds: 600,
      direct: true,
    });
  });

  test("the baseline ignores the hour and uses the segment average", () => {
    expect(predictSegment("baseline:v1", stats, "outbound", "stop-a", "stop-b", 17)).toEqual({
      seconds: 350,
      direct: true,
    });
  });

  test("an unseen segment falls back to the corridor average, flagged indirect", () => {
    expect(predictSegment("baseline:v1", stats, "outbound", "stop-c", "stop-d", 12)).toEqual({
      seconds: 300,
      direct: false,
    });
  });

  test("an unseen hour falls through to the segment average for the model", () => {
    expect(predictSegment("model:v1", stats, "outbound", "stop-b", "stop-c", 9)).toEqual({
      seconds: 200,
      direct: true,
    });
  });

  test("no data at all means no prediction", () => {
    const empty = buildSegmentStats([]);
    expect(predictSegment("baseline:v1", empty, "outbound", "stop-a", "stop-b", 12)).toBeNull();
  });
});

describe("estimateEta", () => {
  const stats = buildSegmentStats([
    obs({ durationSeconds: 100 }),
    obs({ fromStopId: "stop-b", toStopId: "stop-c", durationSeconds: 200, journeyId: "jrn-2" }),
  ]);

  test("sums the segments between the vehicle's nearest stop and the target", () => {
    const eta = estimateEta({
      kind: "baseline:v1",
      stats,
      stopsOutbound: stops,
      direction: "outbound",
      targetStopId: "stop-d",
      vehicle: { lat: -17.7201, lng: 31.046 }, // just past stop-a
      hourBucket: 12,
    });
    // a->b 100 direct, b->c 200 direct, c->d corridor mean 150 indirect
    expect(eta).toEqual({
      etaSeconds: 450,
      source: "baseline:v1",
      basis: { journeys: 2, directSegments: 2, pathSegments: 3 },
    });
  });

  test("inbound reverses the stop order", () => {
    const inboundStats = buildSegmentStats([
      obs({ direction: "inbound", fromStopId: "stop-d", toStopId: "stop-c", durationSeconds: 90 }),
    ]);
    const eta = estimateEta({
      kind: "baseline:v1",
      stats: inboundStats,
      stopsOutbound: stops,
      direction: "inbound",
      targetStopId: "stop-c",
      vehicle: { lat: -17.735, lng: 31.046 }, // at stop-d
      hourBucket: 12,
    });
    expect(eta?.etaSeconds).toBe(90);
    expect(eta?.basis.directSegments).toBe(1);
  });

  test("a vehicle at or past the target reports zero, never negative", () => {
    const eta = estimateEta({
      kind: "baseline:v1",
      stats,
      stopsOutbound: stops,
      direction: "outbound",
      targetStopId: "stop-a",
      vehicle: { lat: -17.73, lng: 31.046 }, // at stop-c, past the target
      hourBucket: 12,
    });
    expect(eta?.etaSeconds).toBe(0);
    expect(eta?.basis.pathSegments).toBe(0);
  });

  test("a target off the route is null", () => {
    const eta = estimateEta({
      kind: "baseline:v1",
      stats,
      stopsOutbound: stops,
      direction: "outbound",
      targetStopId: "stop-x",
      vehicle: { lat: -17.72, lng: 31.046 },
      hourBucket: 12,
    });
    expect(eta).toBeNull();
  });

  test("a route with no data is null, never a made up number", () => {
    const eta = estimateEta({
      kind: "baseline:v1",
      stats: buildSegmentStats([]),
      stopsOutbound: stops,
      direction: "outbound",
      targetStopId: "stop-d",
      vehicle: { lat: -17.72, lng: 31.046 },
      hourBucket: 12,
    });
    expect(eta).toBeNull();
  });
});
