import { describe, it, expect } from "vitest";
import { dict, t, LIVE_LANGUAGES } from "../src/lib/dict";

describe("i18n dictionary", () => {
  it("has a non-empty English and Shona string for every key", () => {
    for (const [key, entry] of Object.entries(dict)) {
      expect(entry.en.trim(), `${key}.en`).not.toBe("");
      expect(entry.sn.trim(), `${key}.sn`).not.toBe("");
    }
  });

  it("t() returns the string for the chosen language", () => {
    expect(t("en", "role.rider")).toBe("Rider");
    expect(t("sn", "role.rider")).toBe("Mufambi");
  });

  it("live languages are only English and Shona; Ndebele is not selectable", () => {
    expect([...LIVE_LANGUAGES]).toEqual(["en", "sn"]);
    expect(LIVE_LANGUAGES).not.toContain("nd");
  });

  it("carries a bilingual Ndebele coming soon label for the roadmap chip", () => {
    expect(t("en", "lang.ndebele")).toBe("Ndebele");
    expect(t("sn", "lang.ndebele")).toBe("Ndebele");
    expect(t("en", "lang.comingSoon")).toBe("coming soon");
    expect(t("sn", "lang.comingSoon").trim()).not.toBe("");
  });
});
