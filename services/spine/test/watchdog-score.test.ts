import { describe, expect, test } from "vitest";
import { DEFAULT_WATCHDOG_CONFIG } from "../src/watchdog/config.ts";
import { simulateHistory } from "../src/watchdog/simulate.ts";
import { scoreHistory } from "../src/watchdog/score.ts";
import { templateNarrator } from "../src/adapters/language.ts";
import { hashSeed } from "../src/watchdog/rng.ts";

const config = DEFAULT_WATCHDOG_CONFIG;
const ROUTE = "HEIGHTS-REZENDE";
const END_DAY = "2026-07-09";

function scored(engine: "forest:v1" | "threshold:v1", badDay = false) {
  const rows = simulateHistory({
    config,
    seed: hashSeed(ROUTE),
    endDay: END_DAY,
    forceLeakOnEndDay: badDay,
  });
  return scoreHistory(rows, {
    routeCode: ROUTE,
    engine,
    narrator: templateNarrator,
    seed: hashSeed(ROUTE),
    contamination: config.leakRate,
  });
}

describe("scoreHistory", () => {
  test("scores every day once and stamps the serving engine", () => {
    const days = scored("forest:v1");
    expect(days).toHaveLength(config.historyDays);
    expect(new Set(days.map((d) => d.features.day)).size).toBe(config.historyDays);
    expect(days.every((d) => d.engine === "forest:v1")).toBe(true);
  });

  test("flagged days carry a bilingual story, clean days carry none", () => {
    const days = scored("forest:v1");
    const flagged = days.filter((d) => d.flagged);
    expect(flagged.length).toBeGreaterThan(0);
    for (const d of flagged) {
      expect(d.explanation?.en).toContain(ROUTE);
      expect(d.explanation?.sn).toContain(ROUTE);
    }
    for (const d of days.filter((x) => !x.flagged)) {
      expect(d.explanation).toBeNull();
    }
  });

  test("the injected bad demo day is caught and explained by the forest", () => {
    const days = scored("forest:v1", true);
    const endDay = days.at(-1)!;
    expect(endDay.features.day).toBe(END_DAY);
    expect(endDay.features.injectedLeakage).toBe("heavy_skim");
    expect(endDay.flagged).toBe(true);
    expect(endDay.explanation?.en.length).toBeGreaterThan(20);
  });

  test("the demo bad day holds the two verdicts apart: forest flags, threshold silent", () => {
    // the story's whole argument on one row: a heavy skim on one kombi of
    // four dilutes to a few percent at route level, so the named fixed
    // threshold stays silent while the forest flags the day
    const endDay = scored("forest:v1", true).at(-1)!;
    expect(endDay.flagged).toBe(true);
    expect(endDay.thresholdFlagged).toBe(false);
  });

  test("every scored day carries the named baseline's verdict beside its own", () => {
    const days = scored("forest:v1");
    for (const d of days) {
      expect(typeof d.thresholdFlagged).toBe("boolean");
      // the threshold verdict is exactly the 60 percent drop rule
      expect(d.thresholdFlagged).toBe(d.features.ticketsRatio < 0.6);
    }
  });

  test("the threshold engine stays available as the fallback scorer", () => {
    const days = scored("threshold:v1");
    expect(days.every((d) => d.engine === "threshold:v1")).toBe(true);
    // the fixed threshold is blind to single vehicle skims, so it flags
    // little or nothing here; that blindness is exactly what the metrics show
    expect(days.filter((d) => d.flagged).length).toBeLessThan(5);
  });
});
