// The real arrival number caller: asks the spine service (GET /eta) for an
// estimate built from recorded rides. The number is real; the vehicle
// position it measures from is the same simulated kombi the map shows (see
// sim-config.ts and the disclosure register). Any miss, timeout, or off
// corridor trip falls back to the mock twin, so the home screen never dies
// because a service is down. Everything here takes injected dependencies so
// it unit tests without a network or the geojson imports.
import type { EtaEstimate, EtaProvider } from "./eta";
import { pointAtDistance, type LngLat, type PolylineMetrics } from "./geometry";
import {
  simulatedTravelAt,
  type SimulatedTravel,
  type SimulatedVehicle,
  type SimulationConfig,
} from "./vehicle-feed";

export type TripDirection = "outbound" | "inbound";

/** Which way a trip runs, from the route's outbound stop order. Null when
 *  either stop is off the route (the mock twin serves those trips). */
export function tripDirection(
  orderedStopIds: string[],
  fromStopId: string,
  toStopId: string,
): TripDirection | null {
  const from = orderedStopIds.indexOf(fromStopId);
  const to = orderedStopIds.indexOf(toStopId);
  if (from === -1 || to === -1 || from === to) return null;
  return from < to ? "outbound" : "inbound";
}

/** Metres along the line of its nearest vertex. The corridor stops were
 *  derived from the line's own points, so nearest vertex is exact enough. */
export function distanceAlongLine(metrics: PolylineMetrics, lngLat: LngLat): number {
  let best = Infinity;
  let at = 0;
  metrics.coordinates.forEach((c, i) => {
    // planar squared degrees: fine for choosing the nearest vertex at city scale
    const d = (c[0] - lngLat[0]) ** 2 + (c[1] - lngLat[1]) ** 2;
    if (d < best) {
      best = d;
      at = metrics.cumulative[i]!;
    }
  });
  return at;
}

/** How far short of the boarding stop a kombi may be and still count as
 *  approaching; covers snap noise between the line and the stop point. */
const APPROACH_GRACE_M = 30;

/** The approaching kombi nearest the boarding stop, or null when every
 *  vehicle heading that way has already passed it. */
export function pickApproachingVehicle(
  travels: SimulatedTravel[],
  direction: TripDirection,
  targetMeters: number,
): SimulatedTravel | null {
  const sameWay = travels.filter((t) => t.direction === direction);
  if (direction === "outbound") {
    const approaching = sameWay.filter((t) => t.meters <= targetMeters + APPROACH_GRACE_M);
    return approaching.sort((a, b) => b.meters - a.meters)[0] ?? null;
  }
  const approaching = sameWay.filter((t) => t.meters >= targetMeters - APPROACH_GRACE_M);
  return approaching.sort((a, b) => a.meters - b.meters)[0] ?? null;
}

export interface CorridorContext {
  routeCode: string;
  /** Stop ids in outbound seq order, from route_stops. */
  orderedStopIds: string[];
  /** The outbound line and the stop points, aligned with orderedStopIds. */
  metrics: PolylineMetrics;
  stopLngLats: LngLat[];
}

export interface SpineEtaDeps {
  baseUrl: string;
  corridor: CorridorContext;
  simConfig: SimulationConfig;
  vehicles: SimulatedVehicle[];
  epochMs: number;
  fallback: EtaProvider;
  fetchFn?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

export class SpineEtaProvider implements EtaProvider {
  constructor(private readonly deps: SpineEtaDeps) {}

  async estimate(fromStopId: string, toStopId: string): Promise<EtaEstimate> {
    try {
      const real = await this.realEstimate(fromStopId, toStopId);
      if (real) return real;
    } catch {
      // the mock twin serves below; the demo never dies on a network miss
    }
    return this.deps.fallback.estimate(fromStopId, toStopId);
  }

  private async realEstimate(
    fromStopId: string,
    toStopId: string,
  ): Promise<EtaEstimate | null> {
    const { corridor } = this.deps;
    if (corridor.orderedStopIds.length !== corridor.stopLngLats.length) return null;

    const direction = tripDirection(corridor.orderedStopIds, fromStopId, toStopId);
    if (!direction) return null;

    const boardIndex = corridor.orderedStopIds.indexOf(fromStopId);
    const targetMeters = distanceAlongLine(corridor.metrics, corridor.stopLngLats[boardIndex]!);

    const now = (this.deps.now ?? Date.now)();
    const travels = this.deps.vehicles.map((v) =>
      simulatedTravelAt(this.deps.simConfig, v, now - this.deps.epochMs),
    );
    let vehicle = pickApproachingVehicle(travels, direction, targetMeters);
    let vehicleDirection = direction;
    // Boarding at a terminus: nothing travels toward the origin of its own
    // leg, but the kombi finishing the opposite leg is the next departure
    // here, so its arrival at the rank is the honest wait.
    const isTerminus =
      (direction === "outbound" && boardIndex === 0) ||
      (direction === "inbound" && boardIndex === corridor.orderedStopIds.length - 1);
    if (!vehicle && isTerminus) {
      vehicleDirection = direction === "outbound" ? "inbound" : "outbound";
      vehicle = pickApproachingVehicle(travels, vehicleDirection, targetMeters);
    }
    if (!vehicle) return null;

    const [lng, lat] = pointAtDistance(corridor.metrics, vehicle.meters);
    const params = new URLSearchParams({
      route: corridor.routeCode,
      direction: vehicleDirection,
      target: fromStopId,
      lat: String(lat),
      lng: String(lng),
    });
    const fetchFn = this.deps.fetchFn ?? fetch;
    const res = await fetchFn(`${this.deps.baseUrl}/eta?${params}`, {
      signal: AbortSignal.timeout(this.deps.timeoutMs ?? 1500),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const body = (await res.json()) as {
      etaSeconds?: unknown;
      basis?: { journeys?: unknown };
    };
    if (typeof body.etaSeconds !== "number") return null;
    const journeys = body.basis?.journeys;
    return {
      minutes: Math.max(1, Math.round(body.etaSeconds / 60)),
      isMock: false,
      rides: typeof journeys === "number" ? journeys : 0,
    };
  }
}
