// Planner tests run against the real seeded network (packages/db/seed/
// network.json), not a toy fixture, because the P1 gate is "the planner
// answers every stop pair in the seeded network". A synthetic disconnected
// network covers the degrade paths.
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  BOARDING_PENALTY_MINUTES,
  planTrip,
  resolveStopQuery,
  segmentFareCents,
  type Network,
  type NetworkRoute,
} from "../src/planner";
import { isPlausibleFareCents } from "../src/fares";

interface RawNetwork {
  stops: Record<string, { name: string; lat: number; lng: number }>;
  routes: {
    code: string;
    name: string;
    typical_duration_minutes: number;
    default_fare_cents: number;
    stops: string[];
    fare_segments: { from: string; to: string; fare_cents: number }[];
  }[];
  transfers: {
    from: string;
    to: string;
    walk_minutes: number;
    walk_meters: number;
  }[];
}

function loadSeededNetwork(): Network {
  const raw = JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "..",
        "..",
        "db",
        "seed",
        "network.json",
      ),
      "utf8",
    ),
  ) as RawNetwork;
  const stops = Object.entries(raw.stops).map(([id, s]) => ({
    id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
  }));
  const routes: NetworkRoute[] = raw.routes.map((r) => ({
    id: r.code,
    code: r.code,
    name: r.name,
    stops: r.stops,
    typicalDurationMinutes: r.typical_duration_minutes,
    defaultFareCents: r.default_fare_cents,
    fareSegments: r.fare_segments.map((s) => ({
      fromStopId: s.from,
      toStopId: s.to,
      fareCents: s.fare_cents,
    })),
  }));
  const transfers = raw.transfers.map((t) => ({
    fromStopId: t.from,
    toStopId: t.to,
    walkMinutes: t.walk_minutes,
    walkMeters: t.walk_meters,
  }));
  return { stops, routes, transfers };
}

const network = loadSeededNetwork();

describe("planTrip on the seeded Harare network", () => {
  test("answers every ordered stop pair in the network (the P1 gate)", () => {
    const failures: string[] = [];
    for (const origin of network.stops) {
      for (const dest of network.stops) {
        if (origin.id === dest.id) continue;
        const plan = planTrip(network, origin.id, dest.id);
        if (!plan) {
          failures.push(`${origin.id} -> ${dest.id}`);
          continue;
        }
        if (plan.legs.length === 0) failures.push(`${origin.id} -> ${dest.id} empty`);
        // rank to rank pairs may resolve as a pure walk; every ride leg that
        // exists must carry a plausible fare
        for (const leg of plan.legs) {
          if (leg.type === "ride" && !isPlausibleFareCents(leg.fareCents)) {
            failures.push(`${origin.id} -> ${dest.id} implausible fare`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test("direct mid route drop: Heights to UZ gate is one leg at the verified tier", () => {
    const plan = planTrip(network, "sp_heights_start_north", "sp_uz_gate");
    expect(plan).not.toBeNull();
    expect(plan!.legs).toHaveLength(1);
    expect(plan!.legs[0]).toMatchObject({
      type: "ride",
      routeCode: "HEIGHTS-REZENDE",
      direction: "outbound",
      fareCents: 150,
    });
  });

  test("prefers the Lomagundi walking transfer over the CBD rank transfer to Avondale", () => {
    const plan = planTrip(network, "sp_heights_start_north", "sp_avondale_shops");
    expect(plan).not.toBeNull();
    const kinds = plan!.legs.map((l) => l.type);
    expect(kinds).toEqual(["ride", "walk", "ride"]);
    const walk = plan!.legs[1];
    expect(walk).toMatchObject({
      type: "walk",
      toStopId: "sp_lomagundi_kinggeorge_pickup",
    });
    expect(plan!.totalFareCents).toBe(250); // 150 to Lomagundi + 100 Avondale leg
  });

  test("suburb to suburb rides through the CBD rank transfer", () => {
    const plan = planTrip(network, "sp_heights_start_north", "sp_samlevys");
    expect(plan).not.toBeNull();
    const rides = plan!.legs.filter((l) => l.type === "ride");
    expect(rides.map((r) => (r as { routeCode: string }).routeCode)).toEqual([
      "HEIGHTS-REZENDE",
      "FOURTHST-BORROWDALE",
    ]);
    expect(plan!.boardings).toBe(2);
  });

  test("rides work in the inbound direction too", () => {
    const plan = planTrip(network, "sp_rezende_rank", "sp_heights_start_north");
    expect(plan).not.toBeNull();
    expect(plan!.legs[0]).toMatchObject({ type: "ride", direction: "inbound" });
    expect(plan!.totalFareCents).toBe(200); // symmetric end to end fare
  });

  test("returns null for a same stop query and for unknown stops", () => {
    expect(planTrip(network, "sp_uz_gate", "sp_uz_gate")).toBeNull();
    expect(planTrip(network, "sp_uz_gate", "sp_nowhere")).toBeNull();
  });

  test("every fare it quotes sits inside the 2026 band", () => {
    for (const origin of network.stops) {
      for (const dest of network.stops) {
        if (origin.id === dest.id) continue;
        const plan = planTrip(network, origin.id, dest.id);
        for (const leg of plan!.legs) {
          if (leg.type === "ride") {
            expect(leg.fareCents).toBeGreaterThanOrEqual(100);
            expect(leg.fareCents).toBeLessThanOrEqual(200);
          }
        }
      }
    }
  });
});

describe("fare rule", () => {
  const route = network.routes.find((r) => r.code === "MARKETSQ-AVONDALE")!;

  test("uses the verified segment tier when one exists, in either order", () => {
    expect(segmentFareCents(route, "sp_marketsq_rank", "sp_pe_kensington")).toBe(100);
    expect(segmentFareCents(route, "sp_pe_kensington", "sp_marketsq_rank")).toBe(100);
  });

  test("falls back to the end to end fare when the pair has no tier", () => {
    // Cork Rd to Avondale has no verified tier; charge the route fare
    expect(segmentFareCents(route, "sp_pe_cork", "sp_avondale_shops")).toBe(150);
  });
});

describe("boarding penalty", () => {
  test("a one seat ride beats a same duration two seat combination", () => {
    const twoSeat: Network = {
      stops: [
        { id: "a", name: "A", lat: 0, lng: 0 },
        { id: "b", name: "B", lat: 0, lng: 1 },
        { id: "c", name: "C", lat: 0, lng: 2 },
      ],
      routes: [
        {
          id: "r1",
          code: "R1",
          name: "A to C direct",
          stops: ["a", "c"],
          typicalDurationMinutes: 30,
          defaultFareCents: 100,
          fareSegments: [],
        },
        {
          id: "r2",
          code: "R2",
          name: "A to B",
          stops: ["a", "b"],
          typicalDurationMinutes: 15,
          defaultFareCents: 100,
          fareSegments: [],
        },
        {
          id: "r3",
          code: "R3",
          name: "B to C",
          stops: ["b", "c"],
          typicalDurationMinutes: 15,
          defaultFareCents: 100,
          fareSegments: [],
        },
      ],
      transfers: [],
    };
    const plan = planTrip(twoSeat, "a", "c");
    expect(plan!.boardings).toBe(1);
    expect(plan!.legs[0]).toMatchObject({ routeCode: "R1" });
    expect(BOARDING_PENALTY_MINUTES).toBeGreaterThan(0);
  });

  test("unreachable pairs return null instead of a fake plan", () => {
    const disconnected: Network = {
      stops: [
        { id: "a", name: "A", lat: 0, lng: 0 },
        { id: "b", name: "B", lat: 0, lng: 1 },
      ],
      routes: [],
      transfers: [],
    };
    expect(planTrip(disconnected, "a", "b")).toBeNull();
  });
});

describe("resolveStopQuery: free text degrades to a picker, never a guess", () => {
  test("resolves a confident alias", () => {
    const r = resolveStopQuery(network, "UZ");
    expect(r.match?.id).toBe("sp_uz_gate");
  });

  test("resolves a suburb name", () => {
    const r = resolveStopQuery(network, "avondale");
    expect(r.match?.id).toBe("sp_avondale_shops");
  });

  test("ambiguous CBD query offers the ranks as a picker instead of guessing", () => {
    const r = resolveStopQuery(network, "town");
    expect(r.match).toBeNull();
    const ids = r.suggestions.map((s) => s.id);
    expect(ids).toContain("sp_rezende_rank");
    expect(ids).toContain("sp_marketsq_rank");
    expect(ids).toContain("sp_fourthst_rank");
  });

  test("unknown text returns no match and the full picker", () => {
    const r = resolveStopQuery(network, "gweru city hall");
    expect(r.match).toBeNull();
    expect(r.suggestions.length).toBe(network.stops.length);
  });

  test("empty text returns the full picker", () => {
    const r = resolveStopQuery(network, "  ");
    expect(r.match).toBeNull();
    expect(r.suggestions.length).toBe(network.stops.length);
  });
});
