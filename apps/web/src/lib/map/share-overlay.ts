// The shared trip as drawable geometry: one ride leg between the trip's two
// stops. On the surveyed corridor the leg follows the real recorded road;
// any other route draws the same straight schematic connector the plan page
// uses. The corridor context is injected so this stays unit testable without
// the geojson imports (same split as eta-live vs eta-home).
import { distanceAlongLine } from "./eta-live";
import { sliceAtDistances, type LngLat, type PolylineMetrics } from "./geometry";

export interface ShareCorridor {
  routeCode: string;
  metrics: PolylineMetrics;
}

export interface ShareOverlay {
  legs: { kind: "ride" | "walk"; coordinates: LngLat[] }[];
  origin: LngLat;
  destination: LngLat;
}

export function buildShareOverlay(
  corridor: ShareCorridor,
  routeCode: string,
  from: LngLat | null,
  to: LngLat | null,
): ShareOverlay | null {
  if (!from || !to) return null;
  const coordinates =
    routeCode === corridor.routeCode
      ? sliceAtDistances(
          corridor.metrics,
          distanceAlongLine(corridor.metrics, from),
          distanceAlongLine(corridor.metrics, to),
        )
      : [from, to];
  return {
    legs: [{ kind: "ride", coordinates }],
    origin: from,
    destination: to,
  };
}
