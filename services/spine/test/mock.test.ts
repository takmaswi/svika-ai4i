import { describe, it, expect } from "vitest";
import { mockSpines } from "../src/adapters/mock";
import { getSpines, health } from "../src/spine";

describe("mock spines", () => {
  it("returns a longer ETA in rush hour than off-peak", async () => {
    const rush = await mockSpines.eta({
      routeId: "r",
      fromStopId: "a",
      toStopId: "b",
      hourOfDay: 7,
    });
    const offPeak = await mockSpines.eta({
      routeId: "r",
      fromStopId: "a",
      toStopId: "b",
      hourOfDay: 11,
    });
    expect(rush.etaSeconds).toBeGreaterThan(offPeak.etaSeconds);
  });

  it("flags a sharp ticket drop as anomalous", async () => {
    const result = await mockSpines.anomaly({
      ownerId: "o",
      day: "2026-07-06",
      ticketCount: 20,
      expectedTickets: 100,
    });
    expect(result.flagged).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it("does not flag a normal revenue day", async () => {
    const result = await mockSpines.anomaly({
      ownerId: "o",
      day: "2026-07-06",
      ticketCount: 95,
      expectedTickets: 100,
    });
    expect(result.flagged).toBe(false);
  });
});

describe("provider selection", () => {
  it("falls back to the mock twin for an unknown provider", () => {
    expect(getSpines("does-not-exist").provider).toBe("mock");
  });

  it("reports healthy with the active provider", () => {
    expect(health(getSpines("mock"))).toEqual({ ok: true, provider: "mock" });
  });
});
