import { describe, expect, test } from "vitest";
import {
  ALLOWED_PLACEHOLDERS,
  EXPLANATION_TEMPLATES,
  getNarrator,
  templateNarrator,
  type AnomalyExplanationInput,
} from "../src/adapters/language.ts";
import { deriveDeviations, explanationInput } from "../src/watchdog/explain.ts";
import type { DayFeatures } from "../src/watchdog/features.ts";

const allTemplates = Object.values(EXPLANATION_TEMPLATES).flatMap((t) => [t.en, t.sn]);

describe("no explanation can name a person (product law)", () => {
  test("templates use only the whitelisted pattern placeholders", () => {
    for (const template of allTemplates) {
      const placeholders = [...template.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
      for (const p of placeholders) {
        expect(ALLOWED_PLACEHOLDERS).toContain(p);
      }
    }
  });

  test("no template contains a person word in either language", () => {
    const personWords = [
      "conductor",
      "driver",
      "hwindi",
      "mutyairi",
      "staff",
      "employee",
      "worker",
      "name",
      "zita",
      "person",
      "munhu",
      "he",
      "she",
      "his",
      "her",
      "they",
      "who",
    ];
    for (const template of allTemplates) {
      for (const word of personWords) {
        const pattern = new RegExp(`\\b${word}\\b`, "i");
        expect(pattern.test(template), `"${word}" found in: ${template}`).toBe(false);
      }
    }
  });

  test("the narrator input type carries no person shaped field", () => {
    // compile time guarantee, restated at runtime: the only keys the
    // narrator ever receives are the route, the day and the deviations
    const input: AnomalyExplanationInput = {
      routeCode: "HEIGHTS-REZENDE",
      day: "2026-07-09",
      deviations: [{ kind: "tickets_low", pct: 20 }],
    };
    expect(Object.keys(input).sort()).toEqual(["day", "deviations", "routeCode"]);
  });

  test("rendered output contains only pattern facts and no leftover slots", () => {
    for (const kind of Object.keys(EXPLANATION_TEMPLATES)) {
      const out = templateNarrator.explain({
        routeCode: "HEIGHTS-REZENDE",
        day: "2026-07-09",
        deviations: [{ kind: kind as keyof typeof EXPLANATION_TEMPLATES, pct: 23 }],
      });
      for (const text of [out.en, out.sn]) {
        expect(text).not.toMatch(/[{}]/);
        expect(text).toContain("HEIGHTS-REZENDE");
        expect(text).toContain("2026-07-09");
      }
    }
  });
});

describe("templateNarrator", () => {
  test("speaks both languages for every deviation kind", () => {
    for (const kind of Object.keys(EXPLANATION_TEMPLATES)) {
      const out = templateNarrator.explain({
        routeCode: "R",
        day: "2026-01-01",
        deviations: [{ kind: kind as keyof typeof EXPLANATION_TEMPLATES, pct: 10 }],
      });
      expect(out.en.length).toBeGreaterThan(20);
      expect(out.sn.length).toBeGreaterThan(20);
    }
  });

  test("no deviations falls back to the combined pattern story", () => {
    const out = templateNarrator.explain({
      routeCode: "R",
      day: "2026-01-01",
      deviations: [],
    });
    expect(out.en).toContain("does not match the usual pattern");
  });

  test("unknown providers fall back to the template twin", () => {
    expect(getNarrator("gemini-not-wired").provider).toBe("template");
    expect(getNarrator().provider).toBe("template");
  });
});

describe("deriveDeviations", () => {
  const day = (overrides: Partial<DayFeatures>): DayFeatures => ({
    day: "2026-07-09",
    tickets: 800,
    ticketsRatio: 1,
    peakShare: 0.45,
    digitalShare: 0.35,
    worstVehicleRatio: 1,
    injectedLeakage: null,
    ...overrides,
  });

  test("a clean day derives nothing, so the pattern fallback tells the story", () => {
    expect(deriveDeviations(day({}), 0.45)).toEqual([]);
  });

  test("a single vehicle collapse leads with the vehicle, strongest first", () => {
    const deviations = deriveDeviations(
      day({ worstVehicleRatio: 0.6, ticketsRatio: 0.88 }),
      0.45,
    );
    expect(deviations[0]).toEqual({ kind: "one_vehicle_low", pct: 40 });
  });

  test("missing rush hours are called out against the usual peak share", () => {
    const deviations = deriveDeviations(day({ peakShare: 0.3 }), 0.45);
    expect(deviations).toEqual([{ kind: "peak_missing", pct: 33 }]);
  });

  test("explanationInput hands the narrator route, day and deviations only", () => {
    const input = explanationInput("HEIGHTS-REZENDE", day({ ticketsRatio: 0.7 }), 0.45);
    expect(input.routeCode).toBe("HEIGHTS-REZENDE");
    expect(input.day).toBe("2026-07-09");
    expect(input.deviations.map((d) => d.kind)).toEqual(["tickets_low"]);
  });
});
