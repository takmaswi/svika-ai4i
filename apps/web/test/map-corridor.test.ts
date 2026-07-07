import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseCorridorRoute, parseCorridorStops } from "../src/lib/map/corridor";
import { measurePolyline } from "../src/lib/map/geometry";

// The real field-derived corridor exports are the fixture: the parser must
// accept exactly what derive.mjs writes.
const geoDir = join(__dirname, "../../../packages/db/seed/geo");
const routeJson = JSON.parse(
  readFileSync(join(geoDir, "corridor.route.geojson"), "utf8"),
);
const stopsJson = JSON.parse(
  readFileSync(join(geoDir, "corridor.stops.geojson"), "utf8"),
);

describe("parseCorridorRoute", () => {
  test("reads both directions of the real corridor", () => {
    const directions = parseCorridorRoute(routeJson);
    expect(directions.map((d) => d.direction).sort()).toEqual([
      "inbound",
      "outbound",
    ]);
    for (const d of directions) {
      expect(d.routeCode).toBe("HEIGHTS-REZENDE");
      expect(d.coordinates.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("matches the surveyed corridor length within 1%", () => {
    const [d] = parseCorridorRoute(routeJson);
    const { totalMeters } = measurePolyline(d!.coordinates);
    expect(Math.abs(totalMeters - 13466) / 13466).toBeLessThan(0.01);
  });

  test("inbound and outbound are the same road reversed", () => {
    const directions = parseCorridorRoute(routeJson);
    const outbound = directions.find((d) => d.direction === "outbound")!;
    const inbound = directions.find((d) => d.direction === "inbound")!;
    expect(outbound.coordinates).toEqual([...inbound.coordinates].reverse());
  });

  test("rejects a payload that is not a feature collection", () => {
    expect(() => parseCorridorRoute({ nope: true })).toThrow(/feature/i);
  });
});

describe("parseCorridorStops", () => {
  test("reads the 15 real stops in field order with their real names", () => {
    const stops = parseCorridorStops(stopsJson);
    expect(stops).toHaveLength(15);
    expect(stops.map((s) => s.order)).toEqual([...stops.keys()]);
    expect(stops[0]!.name).toBe("2nd boom gate");
    expect(stops[14]!.name).toBe("Rezende");
    for (const s of stops) {
      expect(s.name.trim()).not.toBe("");
      expect(s.lngLat[0]).toBeGreaterThan(30);
      expect(s.lngLat[1]).toBeLessThan(-17);
    }
  });

  test("rejects a stop with no name", () => {
    const bad = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "", order: 0 },
          geometry: { type: "Point", coordinates: [31, -17.7] },
        },
      ],
    };
    expect(() => parseCorridorStops(bad)).toThrow(/name/i);
  });
});
