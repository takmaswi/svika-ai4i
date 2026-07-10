// Turns a planned trip into drawable map geometry. Ride legs on the surveyed
// corridor follow the real recorded road line; ride legs on routes without
// recorded geometry draw as straight schematic connectors between their real
// stop points; walking legs always connect real stop points and render
// dashed. Built server side and passed to the map as plain data.
import type { Network, TripPlan } from "@svika/shared";
import { CORRIDOR_ROUTE_CODE, corridorMetrics } from "./corridor-data";
import { distanceAlongLine } from "./eta-live";
import { sliceAtDistances, type LngLat } from "./geometry";

export interface OverlayLeg {
  kind: "ride" | "walk";
  coordinates: LngLat[];
}

export interface PlanOverlay {
  legs: OverlayLeg[];
  origin: LngLat;
  destination: LngLat;
}

export function buildPlanOverlay(network: Network, plan: TripPlan): PlanOverlay | null {
  const stopLngLat = new Map<string, LngLat>(
    network.stops.map((s) => [s.id, [s.lng, s.lat] as LngLat]),
  );
  const origin = stopLngLat.get(plan.originStopId);
  const destination = stopLngLat.get(plan.destinationStopId);
  if (!origin || !destination) return null;

  const legs: OverlayLeg[] = [];
  for (const leg of plan.legs) {
    if (leg.type === "walk") {
      const from = stopLngLat.get(leg.fromStopId);
      const to = stopLngLat.get(leg.toStopId);
      if (!from || !to) return null;
      legs.push({ kind: "walk", coordinates: [from, to] });
      continue;
    }
    const board = stopLngLat.get(leg.boardStopId);
    const alight = stopLngLat.get(leg.alightStopId);
    if (!board || !alight) return null;
    if (leg.routeCode === CORRIDOR_ROUTE_CODE) {
      // the surveyed corridor: ride the real recorded road between the stops
      legs.push({
        kind: "ride",
        coordinates: sliceAtDistances(
          corridorMetrics,
          distanceAlongLine(corridorMetrics, board),
          distanceAlongLine(corridorMetrics, alight),
        ),
      });
    } else {
      legs.push({ kind: "ride", coordinates: [board, alight] });
    }
  }
  return { legs, origin, destination };
}
