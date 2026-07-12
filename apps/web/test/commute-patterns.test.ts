import { describe, expect, test } from "vitest";
import {
  activePattern,
  alertPattern,
  ALERT_ETA_MINUTES,
  etaSaysNear,
  mineCommutePatterns,
  type RideFact,
} from "../src/lib/commute/patterns";

const NOW = new Date("2026-07-10T06:00:00Z"); // 08:00 CAT, a Friday

function ride(
  daysAgo: number,
  catHour: number,
  catMinute: number,
  pair = "a>b",
): RideFact {
  const [from, to] = pair.split(">") as [string, string];
  const at = new Date(NOW);
  at.setUTCDate(at.getUTCDate() - daysAgo);
  at.setUTCHours(catHour - 2, catMinute, 0, 0); // CAT = UTC+2
  return {
    fromStopId: from,
    toStopId: to,
    fromName: from.toUpperCase(),
    toName: to.toUpperCase(),
    purchasedAt: at.toISOString(),
  };
}

describe("mineCommutePatterns", () => {
  test("a two week daily commute becomes one pattern with a sane window", () => {
    const rides = Array.from({ length: 12 }, (_, i) =>
      ride(i + 1, 7, 40 + (i % 3) * 5),
    );
    const patterns = mineCommutePatterns(rides, NOW);
    expect(patterns).toHaveLength(1);
    const p = patterns[0]!;
    expect(p.rides).toBe(12);
    expect(p.days.length).toBeGreaterThanOrEqual(3);
    // median around 07:45 CAT, window plus or minus 45 minutes
    expect(p.medianMinute).toBeGreaterThanOrEqual(7 * 60 + 40);
    expect(p.medianMinute).toBeLessThanOrEqual(7 * 60 + 50);
    expect(p.windowEnd - p.windowStart).toBe(90);
  });

  test("four rides are not a pattern yet", () => {
    const rides = Array.from({ length: 4 }, (_, i) => ride(i + 1, 7, 45));
    expect(mineCommutePatterns(rides, NOW)).toHaveLength(0);
  });

  test("five rides all on the same weekday are not a pattern", () => {
    // 0, 7, 14, 21, 28 days ago: five Fridays inside the lookback
    const rides = Array.from({ length: 5 }, (_, i) => ride(i * 7, 7, 45));
    expect(mineCommutePatterns(rides, NOW)).toHaveLength(0);
  });

  test("rides older than the lookback do not count", () => {
    const rides = Array.from({ length: 12 }, (_, i) => ride(30 + i, 7, 45));
    expect(mineCommutePatterns(rides, NOW)).toHaveLength(0);
  });

  test("two pairs mine separately, busiest first", () => {
    const rides = [
      ...Array.from({ length: 6 }, (_, i) => ride(i + 1, 7, 45, "a>b")),
      ...Array.from({ length: 9 }, (_, i) => ride(i + 1, 17, 15, "b>a")),
    ];
    const patterns = mineCommutePatterns(rides, NOW);
    expect(patterns).toHaveLength(2);
    expect(patterns[0]!.fromStopId).toBe("b");
    expect(patterns[1]!.fromStopId).toBe("a");
  });
});

describe("activePattern", () => {
  const rides = Array.from({ length: 12 }, (_, i) => ride(i + 1, 8, 0));
  const patterns = mineCommutePatterns(rides, NOW);

  test("fires inside the usual window on a usual day", () => {
    expect(activePattern(patterns, NOW)).not.toBeNull(); // 08:00 CAT
  });

  test("silent outside the window", () => {
    const later = new Date(NOW.getTime() + 3 * 60 * 60_000); // 11:00 CAT
    expect(activePattern(patterns, later)).toBeNull();
  });
});

describe("alertPattern", () => {
  const rides = Array.from({ length: 12 }, (_, i) => ride(i + 1, 8, 0));
  const patterns = mineCommutePatterns(rides, NOW);
  const afternoon = new Date(NOW.getTime() + 7 * 60 * 60_000); // 15:00 CAT

  test("a real rider stays gated on the usual window", () => {
    expect(alertPattern(patterns, NOW, { demo: false })).not.toBeNull();
    // well outside the 08:00 window: the real rider gets nothing
    expect(alertPattern(patterns, afternoon, { demo: false })).toBeNull();
  });

  test("a demo persona fires at a non-morning clock, window waived", () => {
    // the landmine: an afternoon stage clock. The real gate would be silent,
    // but the demo persona shows the busiest mined pattern anyway.
    expect(activePattern(patterns, afternoon)).toBeNull();
    const shown = alertPattern(patterns, afternoon, { demo: true });
    expect(shown).not.toBeNull();
    expect(shown!.fromStopId).toBe("a");
  });

  test("a demo persona with no mined pattern still gets no alert", () => {
    const thin = mineCommutePatterns(
      Array.from({ length: 3 }, (_, i) => ride(i + 1, 8, 0)),
      NOW,
    );
    expect(alertPattern(thin, afternoon, { demo: true })).toBeNull();
  });
});

describe("etaSaysNear", () => {
  test("near means at most the threshold", () => {
    expect(etaSaysNear(ALERT_ETA_MINUTES)).toBe(true);
    expect(etaSaysNear(ALERT_ETA_MINUTES + 1)).toBe(false);
    expect(etaSaysNear(2)).toBe(true);
  });
});
