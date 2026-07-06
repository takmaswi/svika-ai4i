import { describe, it, expect } from "vitest";
import { dict, t } from "../src/lib/dict";

describe("i18n dictionary", () => {
  it("has a non-empty English and Shona string for every key", () => {
    for (const [key, entry] of Object.entries(dict)) {
      expect(entry.en.trim(), `${key}.en`).not.toBe("");
      expect(entry.sn.trim(), `${key}.sn`).not.toBe("");
    }
  });

  it("t() returns the string for the chosen language", () => {
    expect(t("en", "app.signOut")).toBe("Sign out");
    expect(t("sn", "app.signOut")).toBe("Buda");
  });
});
