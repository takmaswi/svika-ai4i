import { describe, expect, test } from "vitest";
import { greetingKey, harareHour } from "../src/lib/greeting";

// Harare is UTC+2 all year (no daylight saving), so CAT = UTC + 2.
function atCat(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 6, 10, hour - 2, minute, 0));
}

describe("harareHour", () => {
  test("shifts UTC into Harare time", () => {
    expect(harareHour(atCat(8))).toBe(8);
    expect(harareHour(atCat(0))).toBe(0);
    expect(harareHour(atCat(23))).toBe(23);
  });
});

describe("greetingKey", () => {
  test("morning runs from 05:00 to 11:59 CAT", () => {
    expect(greetingKey(atCat(5))).toBe("morning");
    expect(greetingKey(atCat(8, 30))).toBe("morning");
    expect(greetingKey(atCat(11, 59))).toBe("morning");
  });

  test("afternoon runs from 12:00 to 16:59 CAT", () => {
    expect(greetingKey(atCat(12))).toBe("afternoon");
    expect(greetingKey(atCat(16, 59))).toBe("afternoon");
  });

  test("evening covers 17:00 through the small hours", () => {
    expect(greetingKey(atCat(17))).toBe("evening");
    expect(greetingKey(atCat(21))).toBe("evening");
    expect(greetingKey(atCat(2))).toBe("evening");
    expect(greetingKey(atCat(4, 59))).toBe("evening");
  });
});
