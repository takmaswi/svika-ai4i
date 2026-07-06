import { describe, it, expect } from "vitest";
import { primaryRole } from "../src/roles";

describe("primaryRole", () => {
  it("defaults to rider when no elevation", () => {
    expect(primaryRole({ isOwner: false, isConductor: false })).toBe("rider");
  });

  it("prefers owner over conductor", () => {
    expect(primaryRole({ isOwner: true, isConductor: true })).toBe("owner");
  });

  it("resolves conductor when only conductor", () => {
    expect(primaryRole({ isOwner: false, isConductor: true })).toBe("conductor");
  });
});
