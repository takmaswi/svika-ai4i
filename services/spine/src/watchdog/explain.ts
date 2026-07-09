// Bridges detector features to the language adapter: reads which features
// deviate on a flagged day and hands the narrator only pattern facts
// (route, day, percentages). Nothing person shaped exists on either side.
import type { DayFeatures } from "./features.ts";
import type { AnomalyDeviation, AnomalyExplanationInput } from "../adapters/language.ts";

/** Deviation cutoffs: how far off usual a feature must sit to be named as
 *  the reason. Chosen inside normal jitter bounds of the generator config. */
const TICKETS_LOW_BELOW = 0.85;
const VEHICLE_LOW_BELOW = 0.75;
const PEAK_MISSING_FACTOR = 0.85;

export function deriveDeviations(
  f: DayFeatures,
  usualPeakShare: number,
): AnomalyDeviation[] {
  const deviations: AnomalyDeviation[] = [];
  if (f.worstVehicleRatio < VEHICLE_LOW_BELOW) {
    deviations.push({
      kind: "one_vehicle_low",
      pct: Math.round((1 - f.worstVehicleRatio) * 100),
    });
  }
  if (f.ticketsRatio < TICKETS_LOW_BELOW) {
    deviations.push({ kind: "tickets_low", pct: Math.round((1 - f.ticketsRatio) * 100) });
  }
  if (usualPeakShare > 0 && f.peakShare < usualPeakShare * PEAK_MISSING_FACTOR) {
    deviations.push({
      kind: "peak_missing",
      pct: Math.round((1 - f.peakShare / usualPeakShare) * 100),
    });
  }
  return deviations.sort((a, b) => b.pct - a.pct);
}

export function explanationInput(
  routeCode: string,
  f: DayFeatures,
  usualPeakShare: number,
): AnomalyExplanationInput {
  return { routeCode, day: f.day, deviations: deriveDeviations(f, usualPeakShare) };
}
