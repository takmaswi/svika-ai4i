import { describe, it, expect } from "vitest";
import { dollarsToCents, centsToDollars, formatUsd } from "../src/money";

describe("dollarsToCents", () => {
  it("converts whole and fractional dollars to cents", () => {
    expect(dollarsToCents(1)).toBe(100);
    expect(dollarsToCents(1.5)).toBe(150);
  });

  it("rounds to the nearest cent (no float drift)", () => {
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
  });

  it("rejects non-finite input", () => {
    expect(() => dollarsToCents(Number.NaN)).toThrow();
  });
});

describe("centsToDollars", () => {
  it("inverts dollarsToCents", () => {
    expect(centsToDollars(150)).toBe(1.5);
  });

  it("rejects fractional cents", () => {
    expect(() => centsToDollars(150.5)).toThrow();
  });
});

describe("formatUsd", () => {
  it("formats cents as USD with two decimals", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(5)).toBe("$0.05");
    expect(formatUsd(150)).toBe("$1.50");
    expect(formatUsd(200)).toBe("$2.00");
  });

  it("keeps the sign for negative balances", () => {
    expect(formatUsd(-150)).toBe("-$1.50");
  });
});
