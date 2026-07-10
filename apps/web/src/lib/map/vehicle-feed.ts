// Vehicle positions for the live map, behind an adapter. There is no live
// GPS feed from kombis yet: SimulatedVehicleFeed is the mock twin, replaying
// the two real field rides recorded 2026-07-07 along the real corridor line.
// Each direction keeps its own recorded time curve (the outbound touting ride
// took ~39 riding minutes, the clean return ~26), so the simulated kombis
// speed up, slow down and pause where the real kombi did. A real feed
// implements the same VehicleFeed shape and swaps in without touching the
// map. The simulation is declared in the demo disclosure register; nothing
// here may be presented as live tracking.
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
  /**
   * Exact positions at a wall clock instant, when the feed can know them.
   * The simulated twin is a pure function of time, so the map samples it
   * every animation frame and the kombis stay glued to the road; a real GPS
   * feed will not implement this and the map falls back to gliding between
   * received updates.
   */
  sample?(atMs: number): VehiclePosition[];
}

/**
 * One direction's recorded ride as a time -> metres curve. Metres are always
 * measured along the outbound base line, whichever way the kombi travels, so
 * every consumer shares one coordinate. Derived from the real ride bundles by
 * scripts/derive-sim-profile.mjs; never hand edited.
 */
export interface DirectionProfile {
  durationSeconds: number;
  /** [secondsSinceDeparture, metersAlongOutboundLine], monotone in time. */
  points: ReadonlyArray<readonly [number, number]>;
}

export interface SimulationConfig {
  routeCode: string;
  /** The corridor base line, measured in the outbound direction. */
  metrics: PolylineMetrics;
  /** Real recorded time curves, one per direction (same road both ways). */
  profiles: { outbound: DirectionProfile; inbound: DirectionProfile };
  /** Pause at each rank before turning around. */
  dwellSeconds: number;
}

export interface SimulatedVehicle {
  id: string;
  /** Seconds into the cycle at the epoch; staggers the fleet along the road. */
  phaseSeconds: number;
}

const reverse = (deg: number) => (deg + 180) % 360;

export interface SimulatedTravel {
  /** Metres along the outbound line, regardless of travel direction. */
  meters: number;
  direction: CorridorDirectionName;
}

/** One full loop: out, dwell at the far rank, back, dwell at the near rank. */
export function simulationCycleSeconds(config: SimulationConfig): number {
  return (
    config.profiles.outbound.durationSeconds +
    config.profiles.inbound.durationSeconds +
    2 * config.dwellSeconds
  );
}

/**
 * The four-kombi demo fleet, two per direction at any instant. The phases
 * are deliberately uneven (real headways never metronome), but every gap
 * stays shorter than the shorter leg, so each direction always has at least
 * one kombi on the road and a saved trip always meets a live arrival number.
 * The unit suite proves both properties by sampling a full cycle.
 */
export function standardFleet(cycleSeconds: number): SimulatedVehicle[] {
  const fractions = [0, 0.24, 0.52, 0.77];
  return fractions.map((f, i) => ({
    id: `sim-${i + 1}`,
    phaseSeconds: Math.round(cycleSeconds * f),
  }));
}

// --- monotone cubic interpolation over a profile ---------------------------
// Fritsch-Carlson tangents keep the curve monotone through the recorded
// checkpoints, so a kombi never rolls backwards, while easing through speed
// changes instead of snapping between constant-velocity segments.
interface PreparedProfile {
  xs: number[];
  ys: number[];
  tangents: number[];
}

const prepared = new WeakMap<object, PreparedProfile>();

function prepare(profile: DirectionProfile): PreparedProfile {
  const cached = prepared.get(profile);
  if (cached) return cached;

  const xs = profile.points.map((p) => p[0]);
  const ys = profile.points.map((p) => p[1]);
  const n = xs.length;
  if (n < 2) throw new Error("a direction profile needs at least two points");

  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = xs[i + 1]! - xs[i]!;
    slopes.push(dx === 0 ? 0 : (ys[i + 1]! - ys[i]!) / dx);
  }
  const tangents = [slopes[0]!];
  for (let i = 1; i < n - 1; i++) {
    const a = slopes[i - 1]!;
    const b = slopes[i]!;
    tangents.push(a * b <= 0 ? 0 : (a + b) / 2);
  }
  tangents.push(slopes[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    const s = slopes[i]!;
    if (s === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i]! / s;
    const b = tangents[i + 1]! / s;
    const h = Math.hypot(a, b);
    if (h > 3) {
      tangents[i] = (3 * a * s) / h;
      tangents[i + 1] = (3 * b * s) / h;
    }
  }

  const result = { xs, ys, tangents };
  prepared.set(profile, result);
  return result;
}

/** Metres along the line after `seconds` of the leg, from the recorded curve. */
export function profileMetersAt(profile: DirectionProfile, seconds: number): number {
  const { xs, ys, tangents } = prepare(profile);
  const n = xs.length;
  if (seconds <= xs[0]!) return ys[0]!;
  if (seconds >= xs[n - 1]!) return ys[n - 1]!;
  let lo = 0;
  let hi = n - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (xs[mid]! <= seconds) lo = mid;
    else hi = mid - 1;
  }
  const h = xs[lo + 1]! - xs[lo]!;
  if (h === 0) return ys[lo]!;
  const t = (seconds - xs[lo]!) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return (
    h00 * ys[lo]! +
    h10 * h * tangents[lo]! +
    h01 * ys[lo + 1]! +
    h11 * h * tangents[lo + 1]!
  );
}

/**
 * Where a simulated kombi is after elapsedMs: it replays the recorded
 * outbound ride, dwells at the far rank (already turned to face home),
 * replays the recorded return ride, dwells at the near rank, and repeats.
 * This is the single source of truth for the simulation; the map draws it
 * and the server side ETA caller measures from it, so the two always agree
 * on where a kombi is.
 */
export function simulatedTravelAt(
  config: SimulationConfig,
  vehicle: SimulatedVehicle,
  elapsedMs: number,
): SimulatedTravel {
  const { profiles, metrics } = config;
  const outMs = profiles.outbound.durationSeconds * 1000;
  const inMs = profiles.inbound.durationSeconds * 1000;
  const dwellMs = config.dwellSeconds * 1000;
  const cycleMs = outMs + inMs + 2 * dwellMs;

  const shifted = elapsedMs + vehicle.phaseSeconds * 1000;
  const t = ((shifted % cycleMs) + cycleMs) % cycleMs;

  if (t < outMs) {
    return { direction: "outbound", meters: profileMetersAt(profiles.outbound, t / 1000) };
  }
  if (t < outMs + dwellMs) {
    return { direction: "inbound", meters: metrics.totalMeters };
  }
  if (t < outMs + dwellMs + inMs) {
    return {
      direction: "inbound",
      meters: profileMetersAt(profiles.inbound, (t - outMs - dwellMs) / 1000),
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

  sample(atMs: number): VehiclePosition[] {
    const elapsed = atMs - this.startedAt;
    return this.vehicles.map((v) => simulatedPositionAt(this.config, v, elapsed));
  }

  subscribe(listener: (positions: VehiclePosition[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.sample(this.now()));
    if (!this.timer) {
      this.timer = setInterval(() => {
        const positions = this.sample(this.now());
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
