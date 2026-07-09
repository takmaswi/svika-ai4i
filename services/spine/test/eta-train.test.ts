import { describe, expect, test } from "vitest";
import type { SegmentObservation } from "../src/eta/engine";
import {
  buildMetrics,
  decideVerdict,
  evaluateLeaveOneJourneyOut,
  servedEngine,
  MIN_JOURNEYS_FOR_PROMOTION,
} from "../src/eta/train";

const SEGMENTS = [
  { from: "stop-a", to: "stop-b", base: 100 },
  { from: "stop-b", to: "stop-c", base: 200 },
  { from: "stop-c", to: "stop-d", base: 150 },
];
const RUSH_HOURS = new Set([7, 8, 17, 18]);

/**
 * A synthetic corridor with a strong rush hour effect: rush segments run
 * 1.6x slower. A per hour model can learn that; the per segment baseline
 * averages rush and calm together and must lose.
 */
function syntheticJourneys(count: number): SegmentObservation[] {
  const hours = [7, 8, 9, 12, 17, 18];
  const observations: SegmentObservation[] = [];
  for (let j = 0; j < count; j++) {
    const hour = hours[j % hours.length]!;
    const factor = RUSH_HOURS.has(hour) ? 1.6 : 1;
    const jitter = ((j % 3) - 1) * 5;
    for (const seg of SEGMENTS) {
      observations.push({
        journeyId: `jrn-${j}`,
        direction: "outbound",
        fromStopId: seg.from,
        toStopId: seg.to,
        hourBucket: hour,
        durationSeconds: Math.round(seg.base * factor) + jitter,
      });
    }
  }
  return observations;
}

describe("evaluateLeaveOneJourneyOut", () => {
  test("scores every held out segment for both scorers", () => {
    const report = evaluateLeaveOneJourneyOut(syntheticJourneys(12));
    expect(report.journeys).toBe(12);
    expect(report.segments).toBe(36);
    expect(report.baseline.predictions).toBe(36);
    expect(report.model.predictions).toBe(36);
  });

  test("the hour aware model beats the per segment baseline on rush hour data", () => {
    const report = evaluateLeaveOneJourneyOut(syntheticJourneys(12));
    expect(report.model.maeSeconds).not.toBeNull();
    expect(report.baseline.maeSeconds).not.toBeNull();
    expect(report.model.maeSeconds!).toBeLessThan(report.baseline.maeSeconds!);
  });

  test("a single journey still evaluates with zero predictions, not a crash", () => {
    const report = evaluateLeaveOneJourneyOut(syntheticJourneys(1));
    expect(report.journeys).toBe(1);
    expect(report.baseline.predictions).toBe(0);
    expect(report.baseline.maeSeconds).toBeNull();
  });
});

describe("promotion rule", () => {
  test("promotes the model when data suffices and it wins", () => {
    const report = evaluateLeaveOneJourneyOut(syntheticJourneys(12));
    expect(decideVerdict(report)).toBe("promoted");
    expect(servedEngine("promoted")).toBe("model:v1");
  });

  test("two journeys is insufficient data no matter who wins", () => {
    const report = evaluateLeaveOneJourneyOut(syntheticJourneys(2));
    expect(report.journeys).toBeLessThan(MIN_JOURNEYS_FOR_PROMOTION);
    expect(decideVerdict(report)).toBe("insufficient_data");
    expect(servedEngine("insufficient_data")).toBe("baseline:v1");
  });

  test("with enough journeys but no win, the baseline keeps serving", () => {
    const report = evaluateLeaveOneJourneyOut(syntheticJourneys(12));
    const modelLoses = {
      ...report,
      model: { ...report.model, maeSeconds: report.baseline.maeSeconds! + 1 },
    };
    expect(decideVerdict(modelLoses)).toBe("baseline");
    expect(servedEngine("baseline")).toBe("baseline:v1");
  });
});

describe("buildMetrics", () => {
  test("carries the verdict, the served engine, and the provenance", () => {
    const metrics = buildMetrics(evaluateLeaveOneJourneyOut(syntheticJourneys(12)), {
      routeCode: "TEST-01",
      dataSource: "synthetic",
      generatedAt: "2026-07-09T00:00:00.000Z",
    });
    expect(metrics.verdict).toBe("promoted");
    expect(metrics.served).toBe("model:v1");
    expect(metrics.routeCode).toBe("TEST-01");
    expect(metrics.dataSource).toBe("synthetic");
    expect(metrics.minJourneysForPromotion).toBe(MIN_JOURNEYS_FOR_PROMOTION);
  });
});
