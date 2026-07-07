// Parses the field-derived corridor GeoJSON (packages/db/seed/geo) into the
// shapes the live map consumes. The files are repo artefacts, not user input,
// but they cross a format boundary, so parsing still fails fast and loud.
import type { LngLat } from "./geometry";

export type CorridorDirectionName = "outbound" | "inbound";

export interface CorridorDirection {
  routeCode: string;
  direction: CorridorDirectionName;
  coordinates: LngLat[];
}

export interface CorridorStop {
  name: string;
  order: number;
  lngLat: LngLat;
}

interface Feature {
  type?: unknown;
  properties?: Record<string, unknown> | null;
  geometry?: { type?: unknown; coordinates?: unknown } | null;
}

function featuresOf(geojson: unknown): Feature[] {
  const fc = geojson as { type?: unknown; features?: unknown };
  if (fc?.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
    throw new Error("expected a GeoJSON FeatureCollection");
  }
  return fc.features as Feature[];
}

function isLngLat(value: unknown): value is LngLat {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

export function parseCorridorRoute(geojson: unknown): CorridorDirection[] {
  return featuresOf(geojson).map((f) => {
    const props = f.properties ?? {};
    const direction = props.direction;
    const routeCode = props.route_code;
    if (direction !== "outbound" && direction !== "inbound") {
      throw new Error(`corridor line has an unknown direction: ${String(direction)}`);
    }
    if (typeof routeCode !== "string" || routeCode === "") {
      throw new Error("corridor line is missing its route_code");
    }
    if (f.geometry?.type !== "LineString" || !Array.isArray(f.geometry.coordinates)) {
      throw new Error("corridor line must be a LineString");
    }
    const coordinates = f.geometry.coordinates.map((c) => {
      if (!isLngLat(c)) throw new Error("corridor line has a malformed coordinate");
      return [c[0], c[1]] as LngLat;
    });
    if (coordinates.length < 2) {
      throw new Error("corridor line needs at least two coordinates");
    }
    return { routeCode, direction, coordinates };
  });
}

export function parseCorridorStops(geojson: unknown): CorridorStop[] {
  const stops = featuresOf(geojson).map((f) => {
    const props = f.properties ?? {};
    const name = props.name;
    const order = props.order;
    if (typeof name !== "string" || name.trim() === "") {
      throw new Error("corridor stop is missing its name");
    }
    if (typeof order !== "number") {
      throw new Error(`corridor stop "${name}" is missing its order`);
    }
    const coords = f.geometry?.coordinates;
    if (f.geometry?.type !== "Point" || !isLngLat(coords)) {
      throw new Error(`corridor stop "${name}" must be a Point`);
    }
    return { name, order, lngLat: [coords[0], coords[1]] as LngLat };
  });
  return [...stops].sort((a, b) => a.order - b.order);
}
