import { describe, expect, test } from "vitest";
import { MockEtaProvider, type EtaProvider } from "../src/lib/map/eta";

describe("MockEtaProvider", () => {
  const provider: EtaProvider = new MockEtaProvider();

  test("declares itself a mock so no surface can present it as live", async () => {
    const eta = await provider.estimate("stop-1", "stop-2");
    expect(eta.isMock).toBe(true);
    expect(eta.rides).toBe(0);
  });

  test("returns a plausible kombi wait in minutes", async () => {
    const eta = await provider.estimate("stop-1", "stop-2");
    expect(Number.isInteger(eta.minutes)).toBe(true);
    expect(eta.minutes).toBeGreaterThanOrEqual(2);
    expect(eta.minutes).toBeLessThanOrEqual(15);
  });

  test("is stable for the same stop within the same time bucket", async () => {
    const now = 1_700_000_000_000;
    const p: EtaProvider = new MockEtaProvider(() => now);
    expect((await p.estimate("stop-1", "stop-2")).minutes).toBe(
      (await p.estimate("stop-1", "stop-2")).minutes,
    );
  });

  test("varies across stops", async () => {
    const now = 1_700_000_000_000;
    const p: EtaProvider = new MockEtaProvider(() => now);
    const values = await Promise.all(
      ["a", "b", "c", "d", "e", "f"].map(async (s) => (await p.estimate(s, "z")).minutes),
    );
    expect(new Set(values).size).toBeGreaterThan(1);
  });
});
