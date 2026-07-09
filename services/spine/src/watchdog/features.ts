// Turns per vehicle per day histories into the per route per day feature
// rows the detectors score. Ratios are measured against medians learned from
// a training window only, so evaluation never peeks at the days it judges.
// The single vehicle ratio matters because leakage usually hides inside one
// kombi's takings and dilutes to near nothing at route level.
import { isWeekend, type LeakKind, type VehicleDay } from "./simulate.ts";

export interface DayFeatures {
  day: string;
  tickets: number;
  /** Route total tickets against the median for that kind of day. */
  ticketsRatio: number;
  peakShare: number;
  digitalShare: number;
  /** The worst vehicle's tickets against its own day kind median. */
  worstVehicleRatio: number;
  /** Ground truth carried through for honest scoring; null means clean. */
  injectedLeakage: LeakKind | null;
}

interface DayKindMedian {
  weekday: number;
  weekend: number;
}

export interface FeatureBaseline {
  route: DayKindMedian;
  byVehicle: Map<string, DayKindMedian>;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function groupByDay(rows: VehicleDay[]): Map<string, VehicleDay[]> {
  const byDay = new Map<string, VehicleDay[]>();
  for (const row of rows) {
    const bucket = byDay.get(row.day) ?? [];
    byDay.set(row.day, [...bucket, row]);
  }
  return byDay;
}

function kindMedian(totals: { day: string; value: number }[]): DayKindMedian {
  const pick = (weekend: boolean) =>
    median(totals.filter((t) => isWeekend(t.day) === weekend).map((t) => t.value));
  return { weekday: pick(false), weekend: pick(true) };
}

/** Medians learned from a window of history (the training window in eval). */
export function buildFeatureBaseline(rows: VehicleDay[]): FeatureBaseline {
  const routeTotals = [...groupByDay(rows).entries()].map(([day, dayRows]) => ({
    day,
    value: dayRows.reduce((s, r) => s + r.tickets, 0),
  }));
  const byVehicle = new Map<string, DayKindMedian>();
  const labels = new Set(rows.map((r) => r.vehicleLabel));
  for (const label of labels) {
    const totals = rows
      .filter((r) => r.vehicleLabel === label)
      .map((r) => ({ day: r.day, value: r.tickets }));
    byVehicle.set(label, kindMedian(totals));
  }
  return { route: kindMedian(routeTotals), byVehicle };
}

function ratioFor(value: number, medians: DayKindMedian, day: string): number {
  const base = isWeekend(day) ? medians.weekend : medians.weekday;
  return base > 0 ? value / base : 1;
}

/** One feature row per day, oldest first. */
export function buildDayFeatures(
  rows: VehicleDay[],
  baseline: FeatureBaseline,
): DayFeatures[] {
  return [...groupByDay(rows).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayRows]) => {
      const tickets = dayRows.reduce((s, r) => s + r.tickets, 0);
      const peak = dayRows.reduce((s, r) => s + r.peakTickets, 0);
      const digital = dayRows.reduce((s, r) => s + r.digitalTickets, 0);
      const vehicleRatios = dayRows.map((r) => {
        const medians = baseline.byVehicle.get(r.vehicleLabel);
        return medians ? ratioFor(r.tickets, medians, day) : 1;
      });
      return {
        day,
        tickets,
        ticketsRatio: ratioFor(tickets, baseline.route, day),
        peakShare: tickets > 0 ? peak / tickets : 0,
        digitalShare: tickets > 0 ? digital / tickets : 0,
        worstVehicleRatio: Math.min(...vehicleRatios, 1),
        injectedLeakage: dayRows.find((r) => r.injectedLeakage)?.injectedLeakage ?? null,
      };
    });
}

/** The vector the isolation forest sees. Order is part of the contract. */
export function featureVector(f: DayFeatures): number[] {
  return [f.ticketsRatio, f.peakShare, f.digitalShare, f.worstVehicleRatio];
}
