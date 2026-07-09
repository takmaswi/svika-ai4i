// Ingests gps-logger ride bundles into the ride data pipeline tables
// (journeys, gps_pings, segment_times). Idempotent by natural key: journeys
// on source_ref, pings on (journey, seq), segments on (journey, stop pair).
// Running it twice changes nothing, which the printed counts prove.
//
// This is a data pipeline script in the same trust tier as the seed script:
// it runs on a maintainer's machine or in CI with the service role key from
// .env.local, never inside any app. Usage:
//
//   pnpm spine:ingest                      # the two real 2026-07-07 rides
//   pnpm spine:ingest -- --route CODE --source real_field_ride <bundle.json...>

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseBundle } from "./bundle.ts";
import { buildIngestPlan, type RideSource } from "./plan.ts";
import type { OrderedStop } from "./segments.ts";
import { loadRepoEnv, repoRoot } from "../lib/env.ts";

loadRepoEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

// The two real corridor rides recorded 2026-07-07 are the default input.
const REAL_RIDES_DIR = join(repoRoot, "assets", "Takunda real kombi ride data");
const DEFAULT_BUNDLES = [
  join(
    REAL_RIDES_DIR,
    "Mount Pleasant Heights to Rezende",
    "20260707-1254_journey_2026_07_07_12_54_ij0hz8.bundle.json",
  ),
  join(
    REAL_RIDES_DIR,
    "Rezende to Mount Pleasant Heights",
    "20260707-1512_journey_2026_07_07_15_12_47ni9q.bundle.json",
  ),
];

interface CliArgs {
  routeCode: string;
  source: RideSource;
  uploaderEmail: string;
  bundlePaths: string[];
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    routeCode: "HEIGHTS-REZENDE",
    source: "real_field_ride",
    uploaderEmail: process.env.DEMO_OWNER_EMAIL ?? "",
    bundlePaths: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--route") args.routeCode = argv[++i] ?? args.routeCode;
    else if (a === "--source") {
      const s = argv[++i];
      if (s !== "real_field_ride" && s !== "synthetic" && s !== "demo_sim") {
        throw new Error(`--source must be real_field_ride, synthetic or demo_sim, got ${s}`);
      }
      args.source = s;
    } else if (a === "--uploader") args.uploaderEmail = argv[++i] ?? "";
    else if (a) args.bundlePaths.push(a);
  }
  if (args.bundlePaths.length === 0) args.bundlePaths = DEFAULT_BUNDLES;
  if (!args.uploaderEmail) {
    throw new Error("no uploader: pass --uploader <email> or set DEMO_OWNER_EMAIL");
  }
  return args;
}

async function uploaderProfileId(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`no auth user with email ${email}; run pnpm db:seed first`);
  return user.id;
}

async function loadRoute(code: string): Promise<{ id: string; stops: OrderedStop[] }> {
  const { data: route, error } = await admin
    .from("routes")
    .select("id")
    .eq("code", code)
    .single();
  if (error) throw new Error(`route ${code} not found: ${error.message}`);
  const { data: rows, error: rsErr } = await admin
    .from("route_stops")
    .select("seq, stops (id, lat, lng)")
    .eq("route_id", route.id)
    .eq("direction", "outbound")
    .order("seq");
  if (rsErr) throw rsErr;
  const stops = (rows ?? []).map((r) => {
    const s = r.stops as unknown as { id: string; lat: number; lng: number };
    return { id: s.id, lat: s.lat, lng: s.lng };
  });
  if (stops.length < 2) throw new Error(`route ${code} has no outbound stop sequence`);
  return { id: route.id, stops };
}

async function countRows(table: string, journeyId: string): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("journey_id", journeyId);
  if (error) throw error;
  return count ?? 0;
}

async function ingestBundle(
  path: string,
  routeId: string,
  stops: OrderedStop[],
  source: RideSource,
  uploadedBy: string,
): Promise<void> {
  const bundle = parseBundle(JSON.parse(readFileSync(path, "utf8")));
  const plan = buildIngestPlan(bundle, stops, source);

  const { data: journey, error: jErr } = await admin
    .from("journeys")
    .upsert(
      { ...plan.journey, route_id: routeId, uploaded_by: uploadedBy },
      { onConflict: "source_ref" },
    )
    .select("id")
    .single();
  if (jErr) throw jErr;

  const pingsBefore = await countRows("gps_pings", journey.id);
  const BATCH = 500;
  for (let i = 0; i < plan.pings.length; i += BATCH) {
    const batch = plan.pings.slice(i, i + BATCH).map((p) => ({
      ...p,
      journey_id: journey.id,
    }));
    const { error } = await admin
      .from("gps_pings")
      .upsert(batch, { onConflict: "journey_id,seq", ignoreDuplicates: true });
    if (error) throw error;
  }
  const pingsAfter = await countRows("gps_pings", journey.id);

  const segRows = plan.segments.map((s) => ({
    ...s,
    journey_id: journey.id,
    route_id: routeId,
  }));
  const { error: sErr } = await admin
    .from("segment_times")
    .upsert(segRows, { onConflict: "journey_id,from_stop_id,to_stop_id" });
  if (sErr) throw sErr;

  // drop derived rows a recomputation no longer produces (stop set changed)
  const wanted = new Set(plan.segments.map((s) => `${s.from_stop_id}:${s.to_stop_id}`));
  const { data: existing, error: exErr } = await admin
    .from("segment_times")
    .select("id, from_stop_id, to_stop_id")
    .eq("journey_id", journey.id);
  if (exErr) throw exErr;
  const stale = (existing ?? []).filter(
    (r) => !wanted.has(`${r.from_stop_id}:${r.to_stop_id}`),
  );
  if (stale.length > 0) {
    const { error } = await admin
      .from("segment_times")
      .delete()
      .in(
        "id",
        stale.map((r) => r.id),
      );
    if (error) throw error;
  }

  console.log(
    `${plan.journey.source_ref} (${plan.journey.label}): direction ${plan.journey.direction}, ` +
      `${plan.pings.length} pings in bundle (${pingsAfter - pingsBefore} new, ${pingsAfter} total), ` +
      `${plan.passes.length} stop passes, ${plan.segments.length} segment times`,
  );
}

const args = parseArgs(process.argv.slice(2));
const uploader = await uploaderProfileId(args.uploaderEmail);
const route = await loadRoute(args.routeCode);
for (const path of args.bundlePaths) {
  await ingestBundle(path, route.id, route.stops, args.source, uploader);
}
console.log("ingest complete");
