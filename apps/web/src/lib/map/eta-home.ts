// Wires the home screen's arrival estimates: the spine caller when SPINE_URL
// is configured, the mock twin otherwise. Kept apart from eta-live.ts so the
// logic stays unit testable without the corridor geojson imports.
import { CORRIDOR_ROUTE_CODE, corridorMetrics, corridorStops } from "./corridor-data";
import { MockEtaProvider, type EtaProvider } from "./eta";
import { SpineEtaProvider } from "./eta-live";
import { SIM_EPOCH_MS, SIM_VEHICLES, simConfig } from "./sim-config";

/**
 * orderedStopIds comes from route_stops in outbound seq order; it must line
 * up one to one with the corridor's exported stop points or the wiring is
 * wrong and the mock serves instead.
 */
export function homeEtaProvider(orderedStopIds: string[]): EtaProvider {
  const baseUrl = (process.env.SPINE_URL ?? "").replace(/\/$/, "");
  const mock = new MockEtaProvider();
  if (baseUrl === "" || orderedStopIds.length !== corridorStops.length) return mock;
  return new SpineEtaProvider({
    baseUrl,
    corridor: {
      routeCode: CORRIDOR_ROUTE_CODE,
      orderedStopIds,
      metrics: corridorMetrics,
      stopLngLats: corridorStops.map((s) => s.lngLat),
    },
    simConfig,
    vehicles: SIM_VEHICLES,
    epochMs: SIM_EPOCH_MS,
    fallback: mock,
  });
}
