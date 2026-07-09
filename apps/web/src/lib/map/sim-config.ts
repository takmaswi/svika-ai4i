// The one simulated kombi fleet, shared by the live map (client) and the
// arrival estimate caller (server). Both compute positions from the same
// fixed epoch, so the number a rider reads matches the marker they watch.
// The fleet is a simulation and is declared in the disclosure register.
import { CORRIDOR_ROUTE_CODE, corridorMetrics } from "./corridor-data";
import type { SimulatedVehicle, SimulationConfig } from "./vehicle-feed";

export const SIM_EPOCH_MS = Date.UTC(2026, 0, 1);
export const SIM_DWELL_SECONDS = 20;

export const simConfig: SimulationConfig = {
  routeCode: CORRIDOR_ROUTE_CODE,
  metrics: corridorMetrics,
  dwellSeconds: SIM_DWELL_SECONDS,
};

export const SIM_VEHICLES: SimulatedVehicle[] = [
  { id: "sim-1", startMeters: corridorMetrics.totalMeters * 0.12, headingOut: true },
  { id: "sim-2", startMeters: corridorMetrics.totalMeters * 0.55, headingOut: false },
];
