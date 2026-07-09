// Vehicle positions for the live map, behind an adapter. There is no live
// GPS feed from kombis yet: SimulatedVehicleFeed is the mock twin, moving
// vehicles along the real field-derived corridor line at the speed the field
// ride actually measured. A real feed implements the same VehicleFeed shape
// and swaps in without touching the map. The simulation is declared in the
// demo disclosure register; nothing here may be presented as live tracking.
import type { CorridorDirectionName } from "./corridor";
import {
  headingAtDistance,
  pointAtDistance,
  type LngLat,
  type PolylineMetrics,
} from "./geometry";

export interface VehiclePosition {
  id: string;
  lngLat: LngLat;
  headingDeg: number;
  routeCode: string;
  direction: CorridorDirectionName;
}

export interface VehicleFeed {
  /** Calls the listener straight away, then on every update. Returns unsubscribe. */
  subscribe(listener: (positions: VehiclePosition[]) => void): () => void;
}

/** 13 466 m in 27 riding minutes, measured on the real corridor ride. */
export const DEFAULT_KOMBI_SPEED_MPS = 13466 / (27 * 60);

export interface SimulationConfig {
  routeCode: string;
  /** The corridor base line, measured in the outbound direction. */
  metrics: PolylineMetrics;
  speedMps?: number;
  /** Pause at each rank before turning around. */
  dwellSeconds?: number;
}

export interface SimulatedVehicle {
  id: string;
  /** Metres already travelled along the vehicle's current leg at time zero. */
  startMeters: number;
  headingOut: boolean;
}

const reverse = (deg: number) => (deg + 180) % 360;

export interface SimulatedTravel {
  /** Metres along the outbound line, regardless of travel direction. */
  meters: number;
  direction: CorridorDirectionName;
}

/**
 * How far along the line a simulated kombi is after elapsedMs: it drives the
 * line out, dwells at the far rank (already turned to face home), drives
 * back, dwells at the near rank, and repeats. This is the single source of
 * truth for the simulation; the map draws it and the server side ETA caller
 * measures from it, so the two always agree on where a kombi is.
 */
export function simulatedTravelAt(
  config: SimulationConfig,
  vehicle: SimulatedVehicle,
  elapsedMs: number,
): SimulatedTravel {
  const speed = config.speedMps ?? DEFAULT_KOMBI_SPEED_MPS;
  const { metrics } = config;
  const travelMs = (metrics.totalMeters / speed) * 1000;
  const dwellMs = (config.dwellSeconds ?? 0) * 1000;
  const cycleMs = 2 * (travelMs + dwellMs);

  const offsetMs =
    (vehicle.startMeters / speed) * 1000 +
    (vehicle.headingOut ? 0 : travelMs + dwellMs);
  const t = (((elapsedMs + offsetMs) % cycleMs) + cycleMs) % cycleMs;

  if (t < travelMs) {
    return { direction: "outbound", meters: (speed * t) / 1000 };
  }
  if (t < travelMs + dwellMs) {
    return { direction: "inbound", meters: metrics.totalMeters };
  }
  if (t < 2 * travelMs + dwellMs) {
    return {
      direction: "inbound",
      meters: metrics.totalMeters - (speed * (t - travelMs - dwellMs)) / 1000,
    };
  }
  return { direction: "outbound", meters: 0 };
}

export function simulatedPositionAt(
  config: SimulationConfig,
  vehicle: SimulatedVehicle,
  elapsedMs: number,
): VehiclePosition {
  const travel = simulatedTravelAt(config, vehicle, elapsedMs);
  const heading = headingAtDistance(config.metrics, travel.meters);
  return {
    id: vehicle.id,
    routeCode: config.routeCode,
    direction: travel.direction,
    lngLat: pointAtDistance(config.metrics, travel.meters),
    headingDeg: travel.direction === "inbound" ? reverse(heading) : heading,
  };
}

export class SimulatedVehicleFeed implements VehicleFeed {
  private readonly listeners = new Set<(positions: VehiclePosition[]) => void>();
  private readonly tickMs: number;
  private readonly now: () => number;
  private readonly startedAt: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: SimulationConfig,
    private readonly vehicles: SimulatedVehicle[],
    options: { tickMs?: number; now?: () => number; epochMs?: number } = {},
  ) {
    this.tickMs = options.tickMs ?? 1000;
    this.now = options.now ?? Date.now;
    // A fixed epoch makes the simulation a function of wall clock time, so
    // the server side ETA caller lands on the same positions the map shows.
    this.startedAt = options.epochMs ?? this.now();
  }

  private positions(): VehiclePosition[] {
    const elapsed = this.now() - this.startedAt;
    return this.vehicles.map((v) => simulatedPositionAt(this.config, v, elapsed));
  }

  subscribe(listener: (positions: VehiclePosition[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.positions());
    if (!this.timer) {
      this.timer = setInterval(() => {
        const positions = this.positions();
        for (const l of this.listeners) l(positions);
      }, this.tickMs);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }
}
