// Held out evaluation of the two Spine 3 detectors on labelled synthetic
// replicates: generate a history, fit both detectors on the first stretch,
// score the held out tail against the generator's own ground truth labels,
// and repeat across independent seeds so the verdict does not hang on one
// lucky draw. The promotion rule lives here and only here; serving reads the
// verdict written to metrics/watchdog-metrics.json.
import type { WatchdogConfig } from "./config.ts";
import { simulateHistory } from "./simulate.ts";
import { buildDayFeatures, buildFeatureBaseline } from "./features.ts";
import {
  baselineVerdict,
  fitForestDetector,
  forestVerdict,
  type WatchdogEngine,
} from "./detect.ts";

export interface DetectorEval {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  /** null when the detector never flagged anything. */
  precision: number | null;
  recall: number | null;
  f1: number;
}

export interface WatchdogEvalReport {
  replicates: number;
  trainDaysPerReplicate: number;
  testDaysPerReplicate: number;
  positives: number;
  baseline: DetectorEval;
  forest: DetectorEval;
}

export type WatchdogVerdict = "promoted" | "baseline";

export interface EvalOptions {
  replicates?: number;
  historyDays?: number;
  trainDays?: number;
  seedBase?: number;
  endDay?: string;
}

interface Counts {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

function summarise(c: Counts): DetectorEval {
  const flags = c.tp + c.fp;
  const precision = flags > 0 ? c.tp / flags : null;
  const positives = c.tp + c.fn;
  const recall = positives > 0 ? c.tp / positives : null;
  const f1 =
    precision !== null && recall !== null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;
  const round = (x: number | null) => (x === null ? null : Math.round(x * 1000) / 1000);
  return {
    truePositives: c.tp,
    falsePositives: c.fp,
    falseNegatives: c.fn,
    trueNegatives: c.tn,
    precision: round(precision),
    recall: round(recall),
    f1: round(f1) ?? 0,
  };
}

export function evaluateDetectors(
  config: WatchdogConfig,
  options: EvalOptions = {},
): WatchdogEvalReport {
  const replicates = options.replicates ?? 10;
  const historyDays = options.historyDays ?? 120;
  const trainDays = options.trainDays ?? 84;
  const seedBase = options.seedBase ?? 100;
  const endDay = options.endDay ?? "2026-07-09";
  const evalConfig = { ...config, historyDays };

  const baselineCounts: Counts = { tp: 0, fp: 0, fn: 0, tn: 0 };
  const forestCounts: Counts = { tp: 0, fp: 0, fn: 0, tn: 0 };
  let positives = 0;

  for (let r = 0; r < replicates; r++) {
    const rows = simulateHistory({ config: evalConfig, seed: seedBase + r, endDay });
    const days = [...new Set(rows.map((x) => x.day))].sort();
    const cut = new Set(days.slice(0, trainDays));
    const trainRows = rows.filter((x) => cut.has(x.day));
    const testRows = rows.filter((x) => !cut.has(x.day));

    const featureBaseline = buildFeatureBaseline(trainRows);
    const train = buildDayFeatures(trainRows, featureBaseline);
    const test = buildDayFeatures(testRows, featureBaseline);
    const detector = fitForestDetector(train, {
      seed: seedBase + r,
      contamination: config.leakRate,
    });

    for (const f of test) {
      const truth = f.injectedLeakage !== null;
      if (truth) positives++;
      const tally = (c: Counts, flagged: boolean) => {
        if (truth && flagged) c.tp++;
        else if (!truth && flagged) c.fp++;
        else if (truth && !flagged) c.fn++;
        else c.tn++;
      };
      tally(baselineCounts, baselineVerdict(f).flagged);
      tally(forestCounts, forestVerdict(detector, f).flagged);
    }
  }

  return {
    replicates,
    trainDaysPerReplicate: trainDays,
    testDaysPerReplicate: historyDays - trainDays,
    positives,
    baseline: summarise(baselineCounts),
    forest: summarise(forestCounts),
  };
}

/** The forest serves only when it beats the fixed threshold on F1 over the
 *  held out labelled days. Anything else keeps the baseline serving. */
export function decideWatchdogVerdict(report: WatchdogEvalReport): WatchdogVerdict {
  return report.forest.f1 > report.baseline.f1 ? "promoted" : "baseline";
}

export function servedEngine(verdict: WatchdogVerdict): WatchdogEngine {
  return verdict === "promoted" ? "forest:v1" : "threshold:v1";
}

export interface WatchdogMetrics extends WatchdogEvalReport {
  generatedAt: string;
  dataSource: "synthetic";
  verdict: WatchdogVerdict;
  served: WatchdogEngine;
}

export function buildWatchdogMetrics(
  report: WatchdogEvalReport,
  meta: { generatedAt: string },
): WatchdogMetrics {
  const verdict = decideWatchdogVerdict(report);
  return {
    ...report,
    generatedAt: meta.generatedAt,
    dataSource: "synthetic",
    verdict,
    served: servedEngine(verdict),
  };
}
