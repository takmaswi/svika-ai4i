// The trip planner: a graph over stops with ride edges (any board/alight pair
// on a route, priced from dated fare segments) and walk edges (transfer
// points). Dijkstra minimises weighted minutes, where every boarding pays a
// fixed penalty so the planner prefers fewer kombis when times are close;
// fare breaks ties. Pure and synchronous so it unit tests without a network
// and runs the same on server and client.
//
// Fare rule (mirrors the database): a stop pair with a dated segment fare
// uses the newest effective one; a pair without one is charged the route's
// end to end fare. Never undercharge, never invent a tier.

import type { RouteDirection } from "./types";

export interface NetworkStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface NetworkFareSegment {
  fromStopId: string;
  toStopId: string;
  fareCents: number;
}

export interface NetworkRoute {
  id: string;
  code: string;
  name: string;
  /** ordered stop ids in the outbound direction */
  stops: string[];
  /** end to end minutes for the outbound run */
  typicalDurationMinutes: number;
  /** fallback fare when a pair has no segment tier */
  defaultFareCents: number;
  fareSegments: NetworkFareSegment[];
}

export interface NetworkTransfer {
  fromStopId: string;
  toStopId: string;
  walkMinutes: number;
  walkMeters: number;
}

export interface Network {
  stops: NetworkStop[];
  routes: NetworkRoute[];
  transfers: NetworkTransfer[];
}

export interface RideLeg {
  type: "ride";
  routeId: string;
  routeCode: string;
  routeName: string;
  direction: RouteDirection;
  boardStopId: string;
  alightStopId: string;
  fareCents: number;
  rideMinutes: number;
}

export interface WalkLeg {
  type: "walk";
  fromStopId: string;
  toStopId: string;
  walkMinutes: number;
  walkMeters: number;
}

export type PlanLeg = RideLeg | WalkLeg;

export interface TripPlan {
  originStopId: string;
  destinationStopId: string;
  legs: PlanLeg[];
  totalFareCents: number;
  totalMinutes: number;
  /** number of kombis boarded */
  boardings: number;
}

/** Minutes charged against every boarding: waiting at the stop or rank. */
export const BOARDING_PENALTY_MINUTES = 10;

export function segmentFareCents(
  route: NetworkRoute,
  boardStopId: string,
  alightStopId: string,
): number {
  const hit = route.fareSegments.find(
    (s) =>
      (s.fromStopId === boardStopId && s.toStopId === alightStopId) ||
      (s.fromStopId === alightStopId && s.toStopId === boardStopId),
  );
  return hit ? hit.fareCents : route.defaultFareCents;
}

interface Edge {
  to: string;
  minutes: number;
  fareCents: number;
  leg: PlanLeg;
}

function buildEdges(network: Network): Map<string, Edge[]> {
  const edges = new Map<string, Edge[]>();
  const push = (from: string, e: Edge) => {
    const list = edges.get(from);
    if (list) list.push(e);
    else edges.set(from, [e]);
  };

  for (const route of network.routes) {
    const hops = route.stops.length - 1;
    if (hops < 1) continue;
    const perHop = route.typicalDurationMinutes / hops;
    for (let i = 0; i < route.stops.length; i++) {
      for (let j = 0; j < route.stops.length; j++) {
        if (i === j) continue;
        const board = route.stops[i];
        const alight = route.stops[j];
        if (board === undefined || alight === undefined) continue;
        const rideMinutes = Math.round(Math.abs(j - i) * perHop);
        const fareCents = segmentFareCents(route, board, alight);
        push(board, {
          to: alight,
          minutes: rideMinutes + BOARDING_PENALTY_MINUTES,
          fareCents,
          leg: {
            type: "ride",
            routeId: route.id,
            routeCode: route.code,
            routeName: route.name,
            direction: j > i ? "outbound" : "inbound",
            boardStopId: board,
            alightStopId: alight,
            fareCents,
            rideMinutes,
          },
        });
      }
    }
  }

  for (const t of network.transfers) {
    for (const [from, to] of [
      [t.fromStopId, t.toStopId],
      [t.toStopId, t.fromStopId],
    ] as const) {
      push(from, {
        to,
        minutes: t.walkMinutes,
        fareCents: 0,
        leg: {
          type: "walk",
          fromStopId: from,
          toStopId: to,
          walkMinutes: t.walkMinutes,
          walkMeters: t.walkMeters,
        },
      });
    }
  }

  return edges;
}

/**
 * Shortest path by weighted minutes (ride + walk + boarding penalties),
 * fare as tie break. Returns null when the pair is unknown or unreachable.
 */
export function planTrip(
  network: Network,
  originStopId: string,
  destinationStopId: string,
): TripPlan | null {
  if (originStopId === destinationStopId) return null;
  const known = new Set(network.stops.map((s) => s.id));
  if (!known.has(originStopId) || !known.has(destinationStopId)) return null;

  const edges = buildEdges(network);
  const best = new Map<string, { minutes: number; fare: number }>();
  const prev = new Map<string, { from: string; leg: PlanLeg }>();
  best.set(originStopId, { minutes: 0, fare: 0 });

  // network is tiny (tens of stops); a scan based priority pick is plenty
  const open = new Set<string>([originStopId]);
  const closed = new Set<string>();

  while (open.size > 0) {
    let current: string | null = null;
    let currentCost = { minutes: Infinity, fare: Infinity };
    for (const id of open) {
      const c = best.get(id);
      if (
        c &&
        (c.minutes < currentCost.minutes ||
          (c.minutes === currentCost.minutes && c.fare < currentCost.fare))
      ) {
        current = id;
        currentCost = c;
      }
    }
    if (current === null) break;
    open.delete(current);
    closed.add(current);
    if (current === destinationStopId) break;

    for (const e of edges.get(current) ?? []) {
      if (closed.has(e.to)) continue;
      const candidate = {
        minutes: currentCost.minutes + e.minutes,
        fare: currentCost.fare + e.fareCents,
      };
      const existing = best.get(e.to);
      if (
        !existing ||
        candidate.minutes < existing.minutes ||
        (candidate.minutes === existing.minutes && candidate.fare < existing.fare)
      ) {
        best.set(e.to, candidate);
        prev.set(e.to, { from: current, leg: e.leg });
        open.add(e.to);
      }
    }
  }

  if (!best.has(destinationStopId) || !prev.has(destinationStopId)) return null;

  const legs: PlanLeg[] = [];
  let cursor = destinationStopId;
  while (cursor !== originStopId) {
    const step = prev.get(cursor);
    if (!step) return null;
    legs.unshift(step.leg);
    cursor = step.from;
  }

  const boardings = legs.filter((l) => l.type === "ride").length;
  const totalFareCents = legs.reduce(
    (sum, l) => sum + (l.type === "ride" ? l.fareCents : 0),
    0,
  );
  const totalMinutes = legs.reduce(
    (sum, l) => sum + (l.type === "ride" ? l.rideMinutes : l.walkMinutes),
    0,
  );

  return {
    originStopId,
    destinationStopId,
    legs,
    totalFareCents,
    totalMinutes,
    boardings,
  };
}

// --- free text search ------------------------------------------------------
// Search aliases are synonyms riders actually type for stops that exist in
// the network; they never add geography. Unknown text degrades to a picker:
// resolveStopQuery returns a confident match or a suggestion list, never a
// guess presented as certainty.

const STOP_ALIASES: Record<string, string[]> = {
  "University of Zimbabwe Main Gate (The Chase)": ["uz", "university", "chase"],
  "Rezende Rank": ["rezende", "town", "cbd"],
  "Market Square Rank": ["market square", "musika", "town", "cbd"],
  "Fourth Street Rank": ["fourth street", "4th street", "town", "cbd"],
  "Avondale Shops (King George Rd)": ["avondale"],
  "Sam Levy's Village Bus Stop": ["sam levy", "sam levys", "borrowdale", "village"],
  "Bannockburn Rd North Terminus": ["heights", "mt pleasant", "bannockburn"],
  "Second St at Lomagundi Rd Intersection": ["lomagundi", "second street"],
  "Prince Edward St (Kensington Shops)": ["kensington"],
  "Prince Edward St at Cork Rd Junction": ["cork road", "cork"],
  "King George Rd just off Lomagundi Rd": ["king george"],
};

export interface StopQueryResult {
  /** set only when exactly one stop matches with confidence */
  match: NetworkStop | null;
  /** picker candidates when there is no single confident match */
  suggestions: NetworkStop[];
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveStopQuery(
  network: Network,
  query: string,
): StopQueryResult {
  const q = normalize(query);
  if (q.length === 0) return { match: null, suggestions: network.stops };

  const scored = network.stops.map((stop) => {
    const name = normalize(stop.name);
    const aliases = (STOP_ALIASES[stop.name] ?? []).map(normalize);
    let score = 0;
    if (name === q) score = 100;
    else if (aliases.includes(q)) score = 90;
    else if (name.includes(q)) score = 60;
    else if (aliases.some((a) => a.includes(q) || q.includes(a))) score = 50;
    else {
      const words = q.split(" ");
      const hit = words.filter(
        (w) => w.length >= 3 && (name.includes(w) || aliases.some((a) => a.includes(w))),
      );
      if (hit.length > 0) score = 20 + hit.length * 10;
    }
    return { stop, score };
  });

  const hits = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  if (hits.length === 0) return { match: null, suggestions: network.stops };

  const top = hits[0];
  const second = hits[1];
  const confident =
    top !== undefined &&
    top.score >= 50 &&
    (second === undefined || top.score > second.score);
  return {
    match: confident ? top.stop : null,
    suggestions: hits.map((h) => h.stop),
  };
}
