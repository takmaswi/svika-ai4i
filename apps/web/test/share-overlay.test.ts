import { describe, expect, test } from "vitest";
import { buildShareOverlay, type ShareCorridor } from "../src/lib/map/share-overlay";
import { measurePolyline, type LngLat } from "../src/lib/map/geometry";

// A bent test road: a corridor slice must keep its interior vertices, while
// the schematic connector for a foreign route is always two points.
const road: LngLat[] = [
  [31.05, -17.72],
  [31.05, -17.73],
  [31.06, -17.74],
  [31.06, -17.75],
];
const corridor: ShareCorridor = {
  routeCode: "HEIGHTS-REZENDE",
  metrics: measurePolyline(road),
};

describe("buildShareOverlay", () => {
  test("a corridor trip rides the recorded road with its vertices", () => {
    const overlay = buildShareOverlay(corridor, "HEIGHTS-REZENDE", road[0]!, road[3]!);
    expect(overlay).not.toBeNull();
    expect(overlay!.legs).toHaveLength(1);
    expect(overlay!.legs[0]!.kind).toBe("ride");
    expect(overlay!.legs[0]!.coordinates.length).toBeGreaterThan(2);
    expect(overlay!.origin).toEqual(road[0]);
    expect(overlay!.destination).toEqual(road[3]);
  });

  test("an off corridor trip draws the straight schematic connector", () => {
    const from: LngLat = [31.0, -17.8];
    const to: LngLat = [31.1, -17.9];
    const overlay = buildShareOverlay(corridor, "MARKETSQ-AVONDALE", from, to);
    expect(overlay!.legs[0]!.coordinates).toEqual([from, to]);
  });

  test("nothing draws when a stop point is missing", () => {
    expect(buildShareOverlay(corridor, "HEIGHTS-REZENDE", null, road[0]!)).toBeNull();
    expect(buildShareOverlay(corridor, "HEIGHTS-REZENDE", road[0]!, null)).toBeNull();
  });
});
