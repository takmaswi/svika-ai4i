import { describe, it, expect } from "vitest";
import {
  isPlausibleFareCents,
  assertPlausibleFareCents,
  MIN_FARE_CENTS,
  MAX_FARE_CENTS,
} from "../src/fares";

describe("isPlausibleFareCents", () => {
  it("accepts fares inside the 2026 band", () => {
    expect(isPlausibleFareCents(100)).toBe(true);
    expect(isPlausibleFareCents(MIN_FARE_CENTS)).toBe(true);
    expect(isPlausibleFareCents(MAX_FARE_CENTS)).toBe(true);
  });

  it("rejects fares outside the band or non-integer", () => {
    expect(isPlausibleFareCents(MIN_FARE_CENTS - 1)).toBe(false);
    expect(isPlausibleFareCents(MAX_FARE_CENTS + 1)).toBe(false);
    expect(isPlausibleFareCents(100.5)).toBe(false);
  });
});

describe("assertPlausibleFareCents", () => {
  it("returns the fare when plausible", () => {
    expect(assertPlausibleFareCents(150)).toBe(150);
  });

  it("throws on an implausible fare", () => {
    expect(() => assertPlausibleFareCents(5000)).toThrow();
  });
});
