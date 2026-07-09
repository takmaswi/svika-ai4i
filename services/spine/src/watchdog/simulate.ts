// Generates the synthetic per vehicle per day ticket history the watchdog
// trains and demos on. Pure and seeded: the same seed and config always
// produce the same history, so the committed metrics are reproducible.
// Leakage is injected with known ground truth (injectedLeakage) so the
// detector can be scored honestly against days we know are bad.
//
// Only recorded fares exist here. Skimming removes cash fares from the
// record; digital fares live in the ledger and cannot be skimmed, which is
// the product's whole argument. A short_day removes everything after the
// conductor stops writing, cash and digital alike.
import type { WatchdogConfig, LeakBand } from "./config.ts";
import { mulberry32, uniform, type Rng } from "./rng.ts";

export type LeakKind = "heavy_skim" | "peak_skim" | "short_day";
export const LEAK_KINDS: LeakKind[] = ["heavy_skim", "peak_skim", "short_day"];

export interface VehicleDay {
  day: string;
  vehicleLabel: string;
  tickets: number;
  digitalTickets: number;
  peakTickets: number;
  grossCents: number;
  injectedLeakage: LeakKind | null;
}

export interface SimulateOptions {
  config: WatchdogConfig;
  seed: number;
  /** ISO date of the last generated day, e.g. "2026-07-09". */
  endDay: string;
  /** Force a heavy_skim on one vehicle on the end day (the bad demo day). */
  forceLeakOnEndDay?: boolean;
}

export function addDays(dayIso: string, delta: number): string {
  const d = new Date(`${dayIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function isWeekend(dayIso: string): boolean {
  const dow = new Date(`${dayIso}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cleanVehicleDay(
  config: WatchdogConfig,
  rng: Rng,
  day: string,
  vehicleLabel: string,
): VehicleDay {
  const weekend = isWeekend(day);
  const legs = weekend ? config.weekendLegs : config.weekdayLegs;
  const baseLoad = weekend ? config.weekendLoad : config.weekdayLoad;
  const load = clamp(baseLoad + uniform(rng, -config.loadJitter, config.loadJitter), 0.2, 1);
  const tickets = Math.round(legs * config.seats * load);
  const peakShare = clamp(
    config.peakShare + uniform(rng, -config.peakJitter, config.peakJitter),
    0.1,
    0.8,
  );
  const digitalShare = clamp(
    config.digitalShare + uniform(rng, -config.digitalJitter, config.digitalJitter),
    0.05,
    0.9,
  );
  return {
    day,
    vehicleLabel,
    tickets,
    digitalTickets: Math.round(tickets * digitalShare),
    peakTickets: Math.round(tickets * peakShare),
    grossCents: tickets * config.fareCents,
    injectedLeakage: null,
  };
}

function drawShare(rng: Rng, band: LeakBand): number {
  return uniform(rng, band.min, band.max);
}

/** Applies one leakage pattern to a clean day. Returns a new record. */
export function applyLeak(
  config: WatchdogConfig,
  rng: Rng,
  clean: VehicleDay,
  kind: LeakKind,
): VehicleDay {
  let { tickets, digitalTickets, peakTickets } = clean;
  if (kind === "heavy_skim") {
    const cash = tickets - digitalTickets;
    const removed = Math.min(Math.round(drawShare(rng, config.heavySkim) * cash), cash);
    peakTickets -= Math.round((peakTickets * removed) / Math.max(tickets, 1));
    tickets -= removed;
  } else if (kind === "peak_skim") {
    const peakCash = Math.round(peakTickets * (1 - digitalTickets / Math.max(tickets, 1)));
    const removed = Math.min(
      Math.round(drawShare(rng, config.peakSkim) * peakTickets),
      peakCash,
    );
    tickets -= removed;
    peakTickets -= removed;
  } else {
    // short_day: recording stops mid afternoon, everything after is unwritten
    const share = drawShare(rng, config.shortDay);
    const removed = Math.round(tickets * share);
    digitalTickets -= Math.round(digitalTickets * share);
    // the evening peak falls after the cutoff, so peak loses more than average
    peakTickets -= Math.round(peakTickets * 0.5);
    tickets -= removed;
  }
  digitalTickets = clamp(digitalTickets, 0, tickets);
  peakTickets = clamp(peakTickets, 0, tickets);
  return {
    ...clean,
    tickets,
    digitalTickets,
    peakTickets,
    grossCents: tickets * config.fareCents,
    injectedLeakage: kind,
  };
}

interface LeakPlan {
  vehicleLabels: string[];
  kind: LeakKind;
}

function planLeak(config: WatchdogConfig, rng: Rng, forced: boolean): LeakPlan | null {
  if (!forced && rng() >= config.leakRate) return null;
  const kind = forced ? "heavy_skim" : LEAK_KINDS[Math.floor(rng() * LEAK_KINDS.length)]!;
  const labels = [...config.vehicleLabels];
  const first = labels.splice(Math.floor(rng() * labels.length), 1)[0]!;
  const hit = [first];
  if (!forced && rng() < config.twoVehicleLeakRate && labels.length > 0) {
    hit.push(labels[Math.floor(rng() * labels.length)]!);
  }
  return { vehicleLabels: hit, kind };
}

/** The full synthetic history, oldest day first, one row per vehicle day. */
export function simulateHistory(options: SimulateOptions): VehicleDay[] {
  const { config, endDay } = options;
  const rng = mulberry32(options.seed);
  const rows: VehicleDay[] = [];
  for (let offset = config.historyDays - 1; offset >= 0; offset--) {
    const day = addDays(endDay, -offset);
    const forced = offset === 0 && options.forceLeakOnEndDay === true;
    const leak = planLeak(config, rng, forced);
    for (const label of config.vehicleLabels) {
      const clean = cleanVehicleDay(config, rng, day, label);
      rows.push(
        leak && leak.vehicleLabels.includes(label)
          ? applyLeak(config, rng, clean, leak.kind)
          : clean,
      );
    }
  }
  return rows;
}
