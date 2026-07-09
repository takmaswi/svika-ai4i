import { describe, expect, test } from "vitest";
import type { RouteData } from "../src/eta/data";
import {
  cachedRouteLoader,
  createEtaHandler,
  servedFromMetrics,
} from "../src/eta/service";

const routeData: RouteData = {
  routeId: "route-1",
  stopsOutbound: [
    { id: "stop-a", lat: -17.72, lng: 31.046 },
    { id: "stop-b", lat: -17.725, lng: 31.046 },
    { id: "stop-c", lat: -17.73, lng: 31.046 },
  ],
  observations: [
    {
      journeyId: "jrn-1",
      direction: "outbound",
      fromStopId: "stop-a",
      toStopId: "stop-b",
      hourBucket: 12,
      durationSeconds: 120,
    },
    {
      journeyId: "jrn-2",
      direction: "outbound",
      fromStopId: "stop-b",
      toStopId: "stop-c",
      hourBucket: 12,
      durationSeconds: 180,
    },
  ],
};

const loadRoute = async (code: string) => (code === "TEST-01" ? routeData : null);

const query = (overrides: Record<string, string> = {}) =>
  new URLSearchParams({
    route: "TEST-01",
    direction: "outbound",
    target: "stop-c",
    lat: "-17.72",
    lng: "31.046",
    hour: "12",
    ...overrides,
  });

describe("createEtaHandler", () => {
  const handler = createEtaHandler({ loadRoute, served: "baseline:v1" });

  test("answers with the eta, its source, and its basis", async () => {
    const res = await handler(query());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      etaSeconds: 300,
      source: "baseline:v1",
      basis: { journeys: 2, directSegments: 2, pathSegments: 2 },
    });
  });

  test("serves the model when the metrics verdict promoted it", async () => {
    const promoted = createEtaHandler({ loadRoute, served: "model:v1" });
    const res = await promoted(query());
    expect(res.status).toBe(200);
    expect((res.body as { source: string }).source).toBe("model:v1");
  });

  test("rejects a missing or malformed parameter with a 400", async () => {
    for (const broken of [
      query({ route: "" }),
      query({ direction: "sideways" }),
      query({ target: "" }),
      query({ lat: "not-a-number" }),
      query({ lat: "91" }),
      query({ lng: "181" }),
      query({ hour: "24" }),
      query({ hour: "1.5" }),
    ]) {
      const res = await handler(broken);
      expect(res.status).toBe(400);
    }
  });

  test("an unknown route is a 404, not a made up number", async () => {
    const res = await handler(query({ route: "NOWHERE" }));
    expect(res.status).toBe(404);
  });

  test("a target off the route is a 404", async () => {
    const res = await handler(query({ target: "stop-x" }));
    expect(res.status).toBe(404);
  });

  test("a route with no recorded rides is a 404", async () => {
    const empty = createEtaHandler({
      loadRoute: async () => ({ ...routeData, observations: [] }),
      served: "baseline:v1",
    });
    const res = await empty(query());
    expect(res.status).toBe(404);
  });

  test("defaults the hour to the current Harare hour", async () => {
    // 10:58 UTC is 12:58 in Harare; the 12 hour bucket has direct averages
    const clock = createEtaHandler({
      loadRoute,
      served: "model:v1",
      now: () => Date.parse("2026-07-07T10:58:00.000Z"),
    });
    const params = query();
    params.delete("hour");
    const res = await clock(params);
    expect(res.status).toBe(200);
    expect((res.body as { basis: { directSegments: number } }).basis.directSegments).toBe(2);
  });
});

describe("cachedRouteLoader", () => {
  test("one database trip per route inside the TTL, a fresh one after", async () => {
    let calls = 0;
    let clock = 0;
    const cached = cachedRouteLoader(
      async () => {
        calls += 1;
        return routeData;
      },
      1000,
      () => clock,
    );
    await cached("TEST-01");
    await cached("TEST-01");
    expect(calls).toBe(1);
    clock = 1500;
    await cached("TEST-01");
    expect(calls).toBe(2);
  });
});

describe("servedFromMetrics", () => {
  test("only an explicit promoted verdict serves the model", () => {
    expect(servedFromMetrics({ served: "model:v1" })).toBe("model:v1");
    expect(servedFromMetrics({ served: "baseline:v1" })).toBe("baseline:v1");
    expect(servedFromMetrics({})).toBe("baseline:v1");
    expect(servedFromMetrics(null)).toBe("baseline:v1");
    expect(servedFromMetrics("garbage")).toBe("baseline:v1");
  });
});
