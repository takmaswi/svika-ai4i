// The real Heights <-> Rezende corridor, imported straight from the seed's
// field-derived exports (single source of truth, see packages/db/seed/geo).
// Parsed and validated once at module load; the app fails loudly at build or
// first render if the exports ever change shape.
import routeGeojson from "../../../../../packages/db/seed/geo/corridor.route.geojson";
import stopsGeojson from "../../../../../packages/db/seed/geo/corridor.stops.geojson";
import {
  parseCorridorRoute,
  parseCorridorStops,
  type CorridorDirection,
  type CorridorStop,
} from "./corridor";
import { measurePolyline, type PolylineMetrics } from "./geometry";

const directions = parseCorridorRoute(routeGeojson);
const outbound = directions.find((d) => d.direction === "outbound");
if (!outbound) throw new Error("corridor export has no outbound line");

export const CORRIDOR_ROUTE_CODE = outbound.routeCode;
export const corridorLine: CorridorDirection = outbound;
export const corridorMetrics: PolylineMetrics = measurePolyline(outbound.coordinates);
export const corridorStops: CorridorStop[] = parseCorridorStops(stopsGeojson);
