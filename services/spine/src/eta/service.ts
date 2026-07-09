// The /eta endpoint's logic, kept pure and injectable so it unit tests
// without a server or a database. GET /eta takes a route code, a direction,
// a target stop id, and a vehicle position; the answer carries its source
// engine and its basis (how many recorded rides stand behind the number), so
// no caller can render an estimate without being able to say where it came
// from. Which engine serves is read from metrics.json, the file spine:train
// writes; nothing here decides promotion.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { estimateEta, buildSegmentStats, type EngineKind } from "./engine.ts";
import type { RouteData } from "./data.ts";
import { harareHour } from "../ingest/segments.ts";

export type RouteLoader = (routeCode: string) => Promise<RouteData | null>;

/** The served engine according to a parsed metrics.json; baseline on doubt. */
export function servedFromMetrics(metrics: unknown): EngineKind {
  const served = (metrics as { served?: unknown } | null)?.served;
  return served === "model:v1" ? "model:v1" : "baseline:v1";
}

export function readServedEngine(metricsDir: string): EngineKind {
  try {
    return servedFromMetrics(JSON.parse(readFileSync(join(metricsDir, "metrics.json"), "utf8")));
  } catch {
    return "baseline:v1";
  }
}

/** Route data barely changes while the service runs; a short TTL cache keeps
 *  one database round trip per route per minute instead of per request. */
export function cachedRouteLoader(
  loader: RouteLoader,
  ttlMs = 60_000,
  now: () => number = Date.now,
): RouteLoader {
  const cache = new Map<string, { at: number; value: RouteData | null }>();
  return async (routeCode) => {
    const hit = cache.get(routeCode);
    if (hit && now() - hit.at < ttlMs) return hit.value;
    const value = await loader(routeCode);
    cache.set(routeCode, { at: now(), value });
    return value;
  };
}

export interface EtaHandlerDeps {
  loadRoute: RouteLoader;
  served: EngineKind;
  now?: () => number;
}

export interface EtaResponse {
  status: number;
  body: Record<string, unknown>;
}

const bad = (message: string): EtaResponse => ({ status: 400, body: { error: message } });

export function createEtaHandler(deps: EtaHandlerDeps) {
  const now = deps.now ?? Date.now;

  return async (params: URLSearchParams): Promise<EtaResponse> => {
    const route = params.get("route") ?? "";
    const direction = params.get("direction") ?? "";
    const target = params.get("target") ?? "";
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));

    if (route === "") return bad("route is required");
    if (direction !== "outbound" && direction !== "inbound") {
      return bad("direction must be outbound or inbound");
    }
    if (target === "") return bad("target is required");
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return bad("lat must be a latitude");
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return bad("lng must be a longitude");

    const hourParam = params.get("hour");
    let hourBucket = harareHour(now());
    if (hourParam !== null) {
      const h = Number(hourParam);
      if (!Number.isInteger(h) || h < 0 || h > 23) return bad("hour must be 0 to 23");
      hourBucket = h;
    }

    const data = await deps.loadRoute(route);
    if (!data) return { status: 404, body: { error: `unknown route ${route}` } };
    if (!data.stopsOutbound.some((s) => s.id === target)) {
      return { status: 404, body: { error: "target stop is not on the route" } };
    }
    if (data.observations.length === 0) {
      return { status: 404, body: { error: "no recorded rides for this route yet" } };
    }

    const estimate = estimateEta({
      kind: deps.served,
      stats: buildSegmentStats(data.observations),
      stopsOutbound: data.stopsOutbound,
      direction,
      targetStopId: target,
      vehicle: { lat, lng },
      hourBucket,
    });
    if (!estimate) return { status: 404, body: { error: "no estimate for this request" } };

    return { status: 200, body: { ...estimate } };
  };
}
