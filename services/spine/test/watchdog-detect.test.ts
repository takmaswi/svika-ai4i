import { describe, expect, test } from "vitest";
import { DEFAULT_WATCHDOG_CONFIG } from "../src/watchdog/config.ts";
import { simulateHistory } from "../src/watchdog/simulate.ts";
import {
  buildDayFeatures,
  buildFeatureBaseline,
  featureVector,
  median,
} from "../src/watchdog/features.ts";
import { anomalyScore, buildIsolationForest } from "../src/watchdog/forest.ts";
import {
  BASELINE_DROP_RATIO,
  baselineVerdict,
  fitForestDetector,
  forestVerdict,
  quantile,
  servedFromWatchdogMetrics,
} from "../src/watchdog/detect.ts";
import {
  buildWatchdogMetrics,
  decideWatchdogVerdict,
  evaluateDetectors,
} from "../src/watchdog/eval.ts";

const config = DEFAULT_WATCHDOG_CONFIG;
const END_DAY = "2026-07-09";

describe("features", () => {
  const rows = simulateHistory({ config, seed: 11, endDay: END_DAY });
  const baseline = buildFeatureBaseline(rows);
  const features = buildDayFeatures(rows, baseline);

  test("median handles odd, even and empty inputs", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  test("one feature row per day, oldest first, label carried through", () => {
    expect(features).toHaveLength(config.historyDays);
    expect(features[0]!.day < features.at(-1)!.day).toBe(true);
    const labelled = features.filter((f) => f.injectedLeakage !== null);
    expect(labelled.length).toBeGreaterThan(0);
  });

  test("clean days sit near ratio one, skimmed days sit below", () => {
    const clean = features.filter((f) => f.injectedLeakage === null);
    const cleanMean =
      clean.reduce((s, f) => s + f.ticketsRatio, 0) / clean.length;
    expect(cleanMean).toBeGreaterThan(0.9);
    expect(cleanMean).toBeLessThan(1.1);
    for (const f of features.filter((x) => x.injectedLeakage === "heavy_skim")) {
      expect(f.worstVehicleRatio).toBeLessThan(0.9);
    }
  });

  test("the feature vector order is stable (the forest depends on it)", () => {
    const f = features[0]!;
    expect(featureVector(f)).toEqual([
      f.ticketsRatio,
      f.peakShare,
      f.digitalShare,
      f.worstVehicleRatio,
    ]);
  });
});

describe("isolation forest", () => {
  test("an obvious outlier scores higher than the cluster it left", () => {
    const cluster = Array.from({ length: 200 }, (_, i) => [
      1 + (i % 10) * 0.01,
      0.5 + (i % 7) * 0.01,
    ]);
    const forest = buildIsolationForest(cluster, { seed: 3 });
    const inlier = anomalyScore(forest, [1.05, 0.53]);
    const outlier = anomalyScore(forest, [0.3, 0.1]);
    expect(outlier).toBeGreaterThan(inlier);
    expect(outlier).toBeGreaterThan(0.5);
  });

  test("scores are deterministic for a seed", () => {
    const data = Array.from({ length: 50 }, (_, i) => [i * 0.1, (i % 5) * 0.2]);
    const a = buildIsolationForest(data, { seed: 9 });
    const b = buildIsolationForest(data, { seed: 9 });
    expect(anomalyScore(a, [0.5, 0.5])).toBe(anomalyScore(b, [0.5, 0.5]));
  });

  test("refuses to build from no data", () => {
    expect(() => buildIsolationForest([], { seed: 1 })).toThrow();
  });
});

describe("detectors", () => {
  test("the baseline is the named fixed threshold from the mock twin", () => {
    expect(BASELINE_DROP_RATIO).toBe(0.6);
    const lowDay = {
      day: "2026-01-01",
      tickets: 100,
      ticketsRatio: 0.5,
      peakShare: 0.4,
      digitalShare: 0.3,
      worstVehicleRatio: 0.5,
      injectedLeakage: null,
    };
    const low = baselineVerdict(lowDay);
    expect(low.flagged).toBe(true);
    expect(low.score).toBe(0.5);
    const fine = baselineVerdict({ ...lowDay, ticketsRatio: 0.9 });
    expect(fine.flagged).toBe(false);
  });

  test("quantile picks the requested tail", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(quantile(values, 0.92)).toBe(92);
    expect(quantile([], 0.9)).toBe(0);
  });

  test("the fitted forest flags roughly the contamination share of train days", () => {
    const rows = simulateHistory({ config, seed: 21, endDay: END_DAY });
    const baseline = buildFeatureBaseline(rows);
    const features = buildDayFeatures(rows, baseline);
    const detector = fitForestDetector(features, {
      seed: 21,
      contamination: config.leakRate,
    });
    const flagged = features.filter((f) => forestVerdict(detector, f).flagged);
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged.length).toBeLessThan(features.length * 0.2);
  });

  test("only an explicit forest promotion serves the forest", () => {
    expect(servedFromWatchdogMetrics({ served: "forest:v1" })).toBe("forest:v1");
    expect(servedFromWatchdogMetrics({ served: "threshold:v1" })).toBe("threshold:v1");
    expect(servedFromWatchdogMetrics({ served: "forest:v2" })).toBe("threshold:v1");
    expect(servedFromWatchdogMetrics(null)).toBe("threshold:v1");
    expect(servedFromWatchdogMetrics("promoted")).toBe("threshold:v1");
  });
});

describe("held out evaluation", () => {
  const report = evaluateDetectors(config, { replicates: 6 });

  test("the held out days contain labelled leakage to score against", () => {
    expect(report.positives).toBeGreaterThan(5);
  });

  test("the forest beats the fixed threshold on F1 over held out days", () => {
    expect(report.forest.f1).toBeGreaterThan(report.baseline.f1);
    expect(report.forest.recall ?? 0).toBeGreaterThan(report.baseline.recall ?? 0);
  });

  test("the verdict follows F1 and nothing else", () => {
    expect(decideWatchdogVerdict(report)).toBe("promoted");
    const tied = { ...report, forest: { ...report.forest, f1: report.baseline.f1 } };
    expect(decideWatchdogVerdict(tied)).toBe("baseline");
  });

  test("metrics carry provenance and the served engine", () => {
    const metrics = buildWatchdogMetrics(report, {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    expect(metrics.dataSource).toBe("synthetic");
    expect(metrics.verdict).toBe("promoted");
    expect(metrics.served).toBe("forest:v1");
  });
});
