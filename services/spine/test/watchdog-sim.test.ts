import { describe, expect, test } from "vitest";
import { DEFAULT_WATCHDOG_CONFIG } from "../src/watchdog/config.ts";
import {
  addDays,
  isWeekend,
  simulateHistory,
  type VehicleDay,
} from "../src/watchdog/simulate.ts";

const config = DEFAULT_WATCHDOG_CONFIG;
const END_DAY = "2026-07-09"; // a Thursday

function history(seed = 7, forceLeakOnEndDay = false): VehicleDay[] {
  return simulateHistory({ config, seed, endDay: END_DAY, forceLeakOnEndDay });
}

describe("date helpers", () => {
  test("addDays walks backwards across month edges", () => {
    expect(addDays("2026-07-01", -1)).toBe("2026-06-30");
    expect(addDays("2026-07-09", -89)).toBe("2026-04-11");
  });

  test("isWeekend knows a Harare Sunday from a Thursday", () => {
    expect(isWeekend("2026-07-05")).toBe(true);
    expect(isWeekend("2026-07-09")).toBe(false);
  });
});

describe("simulateHistory", () => {
  test("covers every vehicle on every day of the window", () => {
    const rows = history();
    expect(rows).toHaveLength(config.historyDays * config.vehicleLabels.length);
    expect(rows[0]!.day).toBe(addDays(END_DAY, -(config.historyDays - 1)));
    expect(rows.at(-1)!.day).toBe(END_DAY);
  });

  test("is deterministic for the same seed and differs across seeds", () => {
    expect(history(7)).toEqual(history(7));
    expect(history(7)).not.toEqual(history(8));
  });

  test("every row keeps the recorded fare invariants", () => {
    for (const r of history()) {
      expect(r.tickets).toBeGreaterThanOrEqual(0);
      expect(r.digitalTickets).toBeGreaterThanOrEqual(0);
      expect(r.digitalTickets).toBeLessThanOrEqual(r.tickets);
      expect(r.peakTickets).toBeLessThanOrEqual(r.tickets);
      expect(r.grossCents).toBe(r.tickets * config.fareCents);
    }
  });

  test("weekends run lighter than weekdays", () => {
    const rows = history();
    const mean = (xs: VehicleDay[]) =>
      xs.reduce((s, r) => s + r.tickets, 0) / Math.max(xs.length, 1);
    const weekend = rows.filter((r) => isWeekend(r.day) && !r.injectedLeakage);
    const weekday = rows.filter((r) => !isWeekend(r.day) && !r.injectedLeakage);
    expect(mean(weekend)).toBeLessThan(mean(weekday) * 0.8);
  });

  test("leak days land near the configured route level rate", () => {
    const leakDays = new Set(
      history().filter((r) => r.injectedLeakage).map((r) => r.day),
    );
    const rate = leakDays.size / config.historyDays;
    expect(rate).toBeGreaterThan(0.02);
    expect(rate).toBeLessThan(0.2);
  });

  test("a skimmed vehicle records visibly fewer fares than its clean twin", () => {
    const rows = history();
    const skimmed = rows.filter((r) => r.injectedLeakage === "heavy_skim");
    expect(skimmed.length).toBeGreaterThan(0);
    for (const bad of skimmed) {
      const clean = rows.filter(
        (r) => !r.injectedLeakage && isWeekend(r.day) === isWeekend(bad.day),
      );
      const cleanMean = clean.reduce((s, r) => s + r.tickets, 0) / clean.length;
      expect(bad.tickets).toBeLessThan(cleanMean);
    }
  });

  test("the forced bad demo day is a heavy skim on exactly the end day", () => {
    const rows = history(7, true);
    const endRows = rows.filter((r) => r.day === END_DAY);
    expect(endRows.filter((r) => r.injectedLeakage === "heavy_skim")).toHaveLength(1);
  });

  test("digital fares survive a heavy skim: the ledger cannot be skimmed", () => {
    const clean = history(7).filter((r) => !r.injectedLeakage);
    const skimmed = history(7).filter((r) => r.injectedLeakage === "heavy_skim");
    const share = (xs: VehicleDay[]) =>
      xs.reduce((s, r) => s + r.digitalTickets, 0) /
      Math.max(xs.reduce((s, r) => s + r.tickets, 0), 1);
    expect(share(skimmed)).toBeGreaterThan(share(clean));
  });
});
