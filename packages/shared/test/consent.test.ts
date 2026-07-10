import { describe, expect, test } from "vitest";
import { hasActiveConsent, type ConsentRecord } from "../src/consent";

const at = (action: ConsentRecord["action"], created_at: string): ConsentRecord => ({
  action,
  created_at,
});

describe("hasActiveConsent", () => {
  test("no records means no consent", () => {
    expect(hasActiveConsent([])).toBe(false);
  });

  test("a single accepted record opens the app", () => {
    expect(hasActiveConsent([at("accepted", "2026-07-10T08:00:00Z")])).toBe(true);
  });

  test("a withdrawal after an accept blocks the app again", () => {
    expect(
      hasActiveConsent([
        at("accepted", "2026-07-01T08:00:00Z"),
        at("withdrawn", "2026-07-09T08:00:00Z"),
      ]),
    ).toBe(false);
  });

  test("a fresh accept after a withdrawal opens the app again", () => {
    expect(
      hasActiveConsent([
        at("withdrawn", "2026-07-09T08:00:00Z"),
        at("accepted", "2026-07-10T08:00:00Z"),
      ]),
    ).toBe(true);
  });

  test("input order does not matter, only timestamps do", () => {
    const records = [
      at("withdrawn", "2026-07-09T08:00:00Z"),
      at("accepted", "2026-07-01T08:00:00Z"),
    ];
    expect(hasActiveConsent(records)).toBe(false);
    expect(hasActiveConsent([...records].reverse())).toBe(false);
  });
});
