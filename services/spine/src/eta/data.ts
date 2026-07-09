// Loads what Spine 1 needs from the database: a route's outbound stop order
// and its segment_times observations. Everything read here is public data
// (the seeded network and the derived segment averages), so the anon key is
// enough; no spine code ever holds the service role key.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { OrderedStop } from "../ingest/segments.ts";
import type { Direction, SegmentObservation } from "./engine.ts";

export interface RouteData {
  routeId: string;
  stopsOutbound: OrderedStop[];
  observations: SegmentObservation[];
}

export function anonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Null when the route code does not exist; throws on database errors. */
export async function loadRouteData(
  client: SupabaseClient,
  routeCode: string,
  dataSource = "real_field_ride",
): Promise<RouteData | null> {
  const { data: route, error } = await client
    .from("routes")
    .select("id")
    .eq("code", routeCode)
    .maybeSingle();
  if (error) throw error;
  if (!route) return null;

  const { data: stopRows, error: rsErr } = await client
    .from("route_stops")
    .select("seq, stops (id, lat, lng)")
    .eq("route_id", route.id)
    .eq("direction", "outbound")
    .order("seq");
  if (rsErr) throw rsErr;
  const stopsOutbound: OrderedStop[] = (stopRows ?? []).map((r) => {
    const s = r.stops as unknown as { id: string; lat: number; lng: number };
    return { id: s.id, lat: s.lat, lng: s.lng };
  });

  const { data: segRows, error: stErr } = await client
    .from("segment_times")
    .select("journey_id, direction, from_stop_id, to_stop_id, hour_bucket, duration_seconds")
    .eq("route_id", route.id)
    .eq("source", dataSource);
  if (stErr) throw stErr;
  const observations: SegmentObservation[] = (segRows ?? []).map((r) => ({
    journeyId: r.journey_id as string,
    direction: r.direction as Direction,
    fromStopId: r.from_stop_id as string,
    toStopId: r.to_stop_id as string,
    hourBucket: r.hour_bucket as number,
    durationSeconds: r.duration_seconds as number,
  }));

  return { routeId: route.id, stopsOutbound, observations };
}
