// Provenance copy: the label and the honest card must always match the
// estimate's basis, in both languages, with no way to dress the mock twin
// up as a measurement.
import { describe, expect, it } from "vitest";
import { etaBasisCard, etaBasisLabel } from "../src/lib/eta-provenance";
import type { EtaEstimate } from "../src/lib/map/eta";

const real: EtaEstimate = { minutes: 27, isMock: false, rides: 2 };
const oneRide: EtaEstimate = { minutes: 12, isMock: false, rides: 1 };
const mock: EtaEstimate = { minutes: 9, isMock: true, rides: 0 };

describe("etaBasisLabel", () => {
  it("names the recorded ride count for a real estimate", () => {
    expect(etaBasisLabel("en", real)).toBe("from 2 recorded rides");
    expect(etaBasisLabel("en", oneRide)).toBe("from 1 recorded ride");
  });

  it("labels the mock twin as a demo estimate, never a measurement", () => {
    expect(etaBasisLabel("en", mock)).toBe("demo estimate");
    expect(etaBasisLabel("sn", mock)).not.toContain("recorded");
  });
});

describe("etaBasisCard", () => {
  it("tells the measured story with the ride count and the promotion rule", () => {
    const card = etaBasisCard("en", real);
    expect(card.lines[0]).toContain("2 real rides");
    expect(card.lines.join(" ")).toContain("promotion rule");
    expect(card.lines.join(" ")).not.toContain("demo estimate");
  });

  it("tells the demo story without claiming a measurement", () => {
    const card = etaBasisCard("en", mock);
    expect(card.lines.join(" ")).toContain("not a measurement");
    expect(card.lines.join(" ")).not.toContain("recorded rides");
  });

  it("exists whole in both languages", () => {
    for (const lang of ["en", "sn"] as const) {
      for (const eta of [real, mock]) {
        const card = etaBasisCard(lang, eta);
        expect(card.title.length).toBeGreaterThan(0);
        expect(card.lines.length).toBeGreaterThanOrEqual(2);
        for (const line of card.lines) expect(line.length).toBeGreaterThan(0);
      }
    }
  });
});
