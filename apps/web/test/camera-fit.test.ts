// The camera padding clamp: fitBounds must never receive paddings that meet
// or exceed the container (MapLibre throws and strands the world view, which
// is exactly what happened inside the story stage's shorter screen box).
import { describe, expect, it } from "vitest";
import { clampFitPadding, MIN_MAP_BAND } from "../src/lib/map/camera-fit";

const BOARDING = { top: 150, right: 40, bottom: 420, left: 40 };

describe("clampFitPadding", () => {
  it("passes full screen paddings through untouched", () => {
    expect(clampFitPadding(360, 740, BOARDING)).toEqual(BOARDING);
  });

  it("scales the vertical pair down inside the story stage box", () => {
    const clamped = clampFitPadding(360, 480, BOARDING);
    expect(clamped.top + clamped.bottom).toBeLessThanOrEqual(480 - MIN_MAP_BAND);
    // proportions hold: the sheet still gets most of the clearance
    expect(clamped.bottom).toBeGreaterThan(clamped.top * 2);
    expect(clamped.left).toBe(40);
    expect(clamped.right).toBe(40);
  });

  it("keeps a visible band even in a tiny box", () => {
    const clamped = clampFitPadding(200, 160, BOARDING);
    expect(clamped.top + clamped.bottom).toBeLessThanOrEqual(160 - MIN_MAP_BAND);
    expect(clamped.left + clamped.right).toBeLessThanOrEqual(200 - MIN_MAP_BAND);
  });

  it("handles uniform numeric padding", () => {
    expect(clampFitPadding(360, 740, 48)).toEqual({
      top: 48,
      bottom: 48,
      left: 48,
      right: 48,
    });
    const tight = clampFitPadding(120, 120, 48);
    expect(tight.top + tight.bottom).toBeLessThanOrEqual(120 - MIN_MAP_BAND);
  });
});
