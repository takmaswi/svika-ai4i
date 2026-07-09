// Training and evaluation for Spine 1. The "model" is deliberately simple:
// per segment per hour averages (see engine.ts). What earns it the right to
// serve is not cleverness but evidence: leave one journey out evaluation
// against the named baseline (per segment averages, the naive average from
// AI-USAGE-MAP.md). Each journey is held out in turn, both scorers are fit on
// the remaining journeys, and mean absolute error is measured on the held out
// segments. The verdict is decided here and written to metrics.json; serving
// code reads the verdict from that file and never decides for itself.

import {
  buildSegmentStats,
  predictSegment,
  type EngineKind,
  type SegmentObservation,
} from "./engine.ts";

/** Below this many recorded journeys no model is promoted, full stop. */
export const MIN_JOURNEYS_FOR_PROMOTION = 10;

export type Verdict = "promoted" | "baseline" | "insufficient_data";

export interface ScorerReport {
  maeSeconds: number | null;
  predictions: number;
}

export interface EvalReport {
  journeys: number;
  segments: number;
  baseline: ScorerReport;
  model: ScorerReport;
}

export interface Metrics extends EvalReport {
  generatedAt: string;
  routeCode: string;
  dataSource: string;
  minJourneysForPromotion: number;
  verdict: Verdict;
  served: EngineKind;
}

/**
 * Leave one journey out: for every journey, fit both scorers on the other
 * journeys and score its segments. Segments that no training data can predict
 * at all (empty training set) are skipped and not counted as predictions.
 */
export function evaluateLeaveOneJourneyOut(observations: SegmentObservation[]): EvalReport {
  const journeyIds = [...new Set(observations.map((o) => o.journeyId))];
  const errors: Record<"baseline" | "model", number[]> = { baseline: [], model: [] };

  for (const held of journeyIds) {
    const training = observations.filter((o) => o.journeyId !== held);
    const stats = buildSegmentStats(training);
    for (const o of observations) {
      if (o.journeyId !== held) continue;
      for (const [name, kind] of [
        ["baseline", "baseline:v1"],
        ["model", "model:v1"],
      ] as const) {
        const p = predictSegment(kind, stats, o.direction, o.fromStopId, o.toStopId, o.hourBucket);
        if (p) errors[name].push(Math.abs(p.seconds - o.durationSeconds));
      }
    }
  }

  const report = (errs: number[]): ScorerReport => ({
    maeSeconds:
      errs.length === 0
        ? null
        : Math.round((errs.reduce((a, b) => a + b, 0) / errs.length) * 10) / 10,
    predictions: errs.length,
  });

  return {
    journeys: journeyIds.length,
    segments: observations.length,
    baseline: report(errors.baseline),
    model: report(errors.model),
  };
}

/**
 * The promotion rule, the only place it exists: the model serves when there
 * are enough journeys to trust the evaluation AND it beat the baseline on
 * held out data. Anything else serves the baseline; with too little data the
 * verdict says so honestly instead of pretending a two journey win means
 * anything.
 */
export function decideVerdict(report: EvalReport): Verdict {
  if (report.journeys < MIN_JOURNEYS_FOR_PROMOTION) return "insufficient_data";
  if (
    report.model.maeSeconds !== null &&
    report.baseline.maeSeconds !== null &&
    report.model.predictions >= report.baseline.predictions &&
    report.model.maeSeconds < report.baseline.maeSeconds
  ) {
    return "promoted";
  }
  return "baseline";
}

export function servedEngine(verdict: Verdict): EngineKind {
  return verdict === "promoted" ? "model:v1" : "baseline:v1";
}

export function buildMetrics(
  report: EvalReport,
  meta: { routeCode: string; dataSource: string; generatedAt: string },
): Metrics {
  const verdict = decideVerdict(report);
  return {
    ...report,
    generatedAt: meta.generatedAt,
    routeCode: meta.routeCode,
    dataSource: meta.dataSource,
    minJourneysForPromotion: MIN_JOURNEYS_FOR_PROMOTION,
    verdict,
    served: servedEngine(verdict),
  };
}
