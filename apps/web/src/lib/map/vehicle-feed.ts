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

/**
 * Where a simulated kombi is after elapsedMs: it drives the line out, dwells
 * at the far rank (already turned to face home), drives back, dwells at the
 * near rank, and repeats.
 */
export function simulatedPositionAt(
  config: SimulationConfig,
  vehicle: SimulatedVehicle,
  elapsedMs: number,
): VehiclePosition {
  const speed = config.speedMps ?? DEFAULT_KOMBI_SPEED_MPS;
  const { metrics } = config;
  const travelMs = (metrics.totalMeters / speed) * 1000;
  const dwellMs = (config.dwellSeconds ?? 0) * 1000;
  const cycleMs = 2 * (travelMs + dwellMs);

  const offsetMs =
    (vehicle.startMeters / speed) * 1000 +
    (vehicle.headingOut ? 0 : travelMs + dwellMs);
  const t = (((elapsedMs + offsetMs) % cycleMs) + cycleMs) % cycleMs;

  const shared = { id: vehicle.id, routeCode: config.routeCode };

  if (t < travelMs) {
    const d = (speed * t) / 1000;
    return {
      ...shared,
      direction: "outbound",
      lngLat: pointAtDistance(metrics, d),
      headingDeg: headingAtDistance(metrics, d),
    };
  }
  if (t < travelMs + dwellMs) {
    return {
      ...shared,
      direction: "inbound",
      lngLat: pointAtDistance(metrics, metrics.totalMeters),
      headingDeg: reverse(headingAtDistance(metrics, metrics.totalMeters)),
    };
  }
  if (t < 2 * travelMs + dwellMs) {
    const d = metrics.totalMeters - (speed * (t - travelMs - dwellMs)) / 1000;
    return {
      ...shared,
      direction: "inbound",
      lngLat: pointAtDistance(metrics, d),
      headingDeg: reverse(headingAtDistance(metrics, d)),
    };
  }
  return {
    ...shared,
    direction: "outbound",
    lngLat: pointAtDistance(metrics, 0),
    headingDeg: headingAtDistance(metrics, 0),
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
    options: { tickMs?: number; now?: () => number } = {},
  ) {
    this.tickMs = options.tickMs ?? 1000;
    this.now = options.now ?? Date.now;
    this.startedAt = this.now();
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
