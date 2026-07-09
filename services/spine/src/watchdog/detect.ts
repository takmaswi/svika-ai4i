// The two Spine 3 detectors and the promotion rule between them.
//
// Baseline (the named fixed threshold, same rule as adapters/mock.ts): flag a
// day when route tickets fall below 60 percent of the usual level. Honest,
// simple, and blind to the common case where one kombi's skim dilutes to a
// few percent at route level.
//
// Model: an isolation forest over the per route per day feature vector. It
// serves only while the committed watchdog metrics say it beat the baseline
// on held out labelled days; serving code reads the verdict file and nothing
// else decides, exactly like Spine 1.
import { buildIsolationForest, anomalyScore, type IsolationForest } from "./forest.ts";
import { featureVector, type DayFeatures } from "./features.ts";

/** Matches ANOMALY_DROP_RATIO in adapters/mock.ts, the named baseline. */
export const BASELINE_DROP_RATIO = 0.6;

export type WatchdogEngine = "threshold:v1" | "forest:v1";

export interface DayVerdict {
  day: string;
  score: number;
  flagged: boolean;
}

export function baselineVerdict(f: DayFeatures): DayVerdict {
  const score = Math.min(Math.max(1 - f.ticketsRatio, 0), 1);
  return { day: f.day, score, flagged: f.ticketsRatio < BASELINE_DROP_RATIO };
}

export interface ForestDetector {
  forest: IsolationForest;
  /** Scores above this are flagged; the train score quantile at 1 minus
   *  the expected leak rate. */
  threshold: number;
}

export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[pos]!;
}

export function fitForestDetector(
  train: DayFeatures[],
  options: { seed: number; contamination: number },
): ForestDetector {
  const vectors = train.map(featureVector);
  const forest = buildIsolationForest(vectors, { seed: options.seed });
  const scores = vectors.map((v) => anomalyScore(forest, v));
  return { forest, threshold: quantile(scores, 1 - options.contamination) };
}

export function forestVerdict(detector: ForestDetector, f: DayFeatures): DayVerdict {
  const score = anomalyScore(detector.forest, featureVector(f));
  return { day: f.day, score, flagged: score > detector.threshold };
}

/** Hardened reader for the committed metrics verdict: anything that is not
 *  an explicit promotion serves the baseline. */
export function servedFromWatchdogMetrics(metrics: unknown): WatchdogEngine {
  if (
    typeof metrics === "object" &&
    metrics !== null &&
    (metrics as { served?: unknown }).served === "forest:v1"
  ) {
    return "forest:v1";
  }
  return "threshold:v1";
}
