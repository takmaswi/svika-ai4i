// Scores a generated history with whichever detector the committed metrics
// verdict promoted, and writes the bilingual narrative for every flagged
// day. Pure: run.ts owns all database traffic.
import type { VehicleDay } from "./simulate.ts";
import { buildDayFeatures, buildFeatureBaseline, median, type DayFeatures } from "./features.ts";
import {
  baselineVerdict,
  fitForestDetector,
  forestVerdict,
  type WatchdogEngine,
} from "./detect.ts";
import { explanationInput } from "./explain.ts";
import type { AnomalyNarrator, Bilingual } from "../adapters/language.ts";

export interface ScoredDay {
  features: DayFeatures;
  score: number;
  flagged: boolean;
  engine: WatchdogEngine;
  /** Present only on flagged days. */
  explanation: Bilingual | null;
}

export interface ScoreOptions {
  routeCode: string;
  engine: WatchdogEngine;
  narrator: AnomalyNarrator;
  seed: number;
  contamination: number;
}

/** The detector fits on this many oldest days, the same split the committed
 *  evaluation used, so the newest days are judged out of sample the way a
 *  live day would be instead of competing inside their own training set. */
const SERVE_TRAIN_DAYS = 84;

export function scoreHistory(rows: VehicleDay[], options: ScoreOptions): ScoredDay[] {
  const days = [...new Set(rows.map((r) => r.day))].sort();
  const trainCut = new Set(days.slice(0, Math.min(SERVE_TRAIN_DAYS, days.length)));
  const trainRows = rows.filter((r) => trainCut.has(r.day));

  const featureBaseline = buildFeatureBaseline(trainRows);
  const trainFeatures = buildDayFeatures(trainRows, featureBaseline);
  const features = buildDayFeatures(rows, featureBaseline);
  const detector =
    options.engine === "forest:v1"
      ? fitForestDetector(trainFeatures, {
          seed: options.seed,
          contamination: options.contamination,
        })
      : null;
  const usualPeakShare = median(trainFeatures.map((f) => f.peakShare));

  return features.map((f) => {
    const verdict = detector ? forestVerdict(detector, f) : baselineVerdict(f);
    return {
      features: f,
      score: Math.round(verdict.score * 1000) / 1000,
      flagged: verdict.flagged,
      engine: options.engine,
      explanation: verdict.flagged
        ? options.narrator.explain(explanationInput(options.routeCode, f, usualPeakShare))
        : null,
    };
  });
}
