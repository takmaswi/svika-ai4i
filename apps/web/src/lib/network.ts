// Loads the transit network from Supabase (all public read tables) and maps
// it into the shared planner's Network shape. Fare rows arrive as full dated
// history; only the newest effective row per pair is kept, mirroring
// segment_fare_cents in the database.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Network, NetworkRoute, NetworkStop } from "@svika/shared";

const FALLBACK_ROUTE_MINUTES = 30;

interface RouteRow {
  id: string;
  code: string;
  name: string;
  typical_duration_minutes: number | null;
}

interface RouteStopRow {
  route_id: string;
  stop_id: string;
  direction: "outbound" | "inbound";
  seq: number;
}

interface FareSegmentRow {
  route_id: string;
  from_stop_id: string;
  to_stop_id: string;
  fare_cents: number;
  effective_from: string;
}

interface RouteFareRow {
  route_id: string;
  fare_cents: number;
  effective_from: string;
}

export async function fetchNetwork(supabase: SupabaseClient): Promise<Network> {
  const nowIso = new Date().toISOString();
  const [stopsRes, routesRes, routeStopsRes, faresRes, routeFaresRes, transfersRes] =
    await Promise.all([
      supabase.from("stops").select("id, name, lat, lng"),
      supabase
        .from("routes")
        .select("id, code, name, typical_duration_minutes")
        .eq("active", true)
        .neq("code", "TEST-01"),
      supabase
        .from("route_stops")
        .select("route_id, stop_id, direction, seq")
        .eq("direction", "outbound")
        .order("seq"),
      supabase
        .from("fare_segments")
        .select("route_id, from_stop_id, to_stop_id, fare_cents, effective_from")
        .lte("effective_from", nowIso)
        .order("effective_from", { ascending: false }),
      supabase
        .from("route_fares")
        .select("route_id, fare_cents, effective_from")
        .lte("effective_from", nowIso)
        .order("effective_from", { ascending: false }),
      supabase
        .from("transfer_points")
        .select("from_stop_id, to_stop_id, walk_minutes, walk_meters"),
    ]);

  for (const res of [
    stopsRes,
    routesRes,
    routeStopsRes,
    faresRes,
    routeFaresRes,
    transfersRes,
  ]) {
    if (res.error) throw new Error(`network load failed: ${res.error.message}`);
  }

  const stopsById = new Map<string, NetworkStop>();
  for (const s of (stopsRes.data ?? []) as NetworkStop[]) stopsById.set(s.id, s);

  // newest effective end to end fare per route
  const routeFare = new Map<string, number>();
  for (const f of (routeFaresRes.data ?? []) as RouteFareRow[]) {
    if (!routeFare.has(f.route_id)) routeFare.set(f.route_id, f.fare_cents);
  }

  // newest effective fare per (route, unordered pair)
  const segFares = new Map<
    string,
    { from: string; to: string; route: string; fare: number }
  >();
  for (const f of (faresRes.data ?? []) as FareSegmentRow[]) {
    const key =
      f.from_stop_id < f.to_stop_id
        ? `${f.route_id}:${f.from_stop_id}:${f.to_stop_id}`
        : `${f.route_id}:${f.to_stop_id}:${f.from_stop_id}`;
    if (!segFares.has(key)) {
      segFares.set(key, {
        route: f.route_id,
        from: f.from_stop_id,
        to: f.to_stop_id,
        fare: f.fare_cents,
      });
    }
  }

  const stopsByRoute = new Map<string, string[]>();
  for (const rs of (routeStopsRes.data ?? []) as RouteStopRow[]) {
    const list = stopsByRoute.get(rs.route_id) ?? [];
    list.push(rs.stop_id);
    stopsByRoute.set(rs.route_id, list);
  }

  const usedStopIds = new Set<string>();
  const routes: NetworkRoute[] = [];
  for (const r of (routesRes.data ?? []) as RouteRow[]) {
    const orderedStops = stopsByRoute.get(r.id) ?? [];
    if (orderedStops.length < 2) continue;
    for (const sid of orderedStops) usedStopIds.add(sid);
    const fareSegments = [...segFares.values()]
      .filter((s) => s.route === r.id)
      .map((s) => ({ fromStopId: s.from, toStopId: s.to, fareCents: s.fare }));
    routes.push({
      id: r.id,
      code: r.code,
      name: r.name,
      stops: orderedStops,
      typicalDurationMinutes: r.typical_duration_minutes ?? FALLBACK_ROUTE_MINUTES,
      defaultFareCents: routeFare.get(r.id) ?? 0,
      fareSegments,
    });
  }

  const transfers = (
    (transfersRes.data ?? []) as {
      from_stop_id: string;
      to_stop_id: string;
      walk_minutes: number;
      walk_meters: number;
    }[]
  ).map((t) => {
    usedStopIds.add(t.from_stop_id);
    usedStopIds.add(t.to_stop_id);
    return {
      fromStopId: t.from_stop_id,
      toStopId: t.to_stop_id,
      walkMinutes: t.walk_minutes,
      walkMeters: t.walk_meters,
    };
  });

  // only stops that belong to the live network (keeps test fixtures out)
  const stops = [...usedStopIds]
    .map((id) => stopsById.get(id))
    .filter((s): s is NetworkStop => s !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { stops, routes, transfers };
}
