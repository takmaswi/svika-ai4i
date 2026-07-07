import { describe, expect, test } from "vitest";
import { MockEtaProvider, type EtaProvider } from "../src/lib/map/eta";

describe("MockEtaProvider", () => {
  const provider: EtaProvider = new MockEtaProvider();

  test("declares itself a mock so no surface can present it as live", () => {
    expect(provider.isMock).toBe(true);
  });

  test("returns a plausible kombi wait in minutes", async () => {
    const eta = await provider.etaMinutes("stop-1");
    expect(Number.isInteger(eta)).toBe(true);
    expect(eta).toBeGreaterThanOrEqual(2);
    expect(eta).toBeLessThanOrEqual(15);
  });

  test("is stable for the same stop within the same time bucket", async () => {
    const now = 1_700_000_000_000;
    const p = new MockEtaProvider(() => now);
    expect(await p.etaMinutes("stop-1")).toBe(await p.etaMinutes("stop-1"));
  });

  test("varies across stops", async () => {
    const now = 1_700_000_000_000;
    const p = new MockEtaProvider(() => now);
    const values = await Promise.all(
      ["a", "b", "c", "d", "e", "f"].map((s) => p.etaMinutes(s)),
    );
    expect(new Set(values).size).toBeGreaterThan(1);
  });
});
