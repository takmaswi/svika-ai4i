// Regenerates the watchdog's synthetic history in the database and scores it
// with whichever detector the committed metrics verdict promoted. Idempotent:
// it wipes and rewrites its own synthetic rows for the target owner and
// route, and never touches tickets, ledger rows, or the real fleet.
//
// This is a data pipeline script in the same trust tier as the seed script:
// it runs on a maintainer's machine or in CI with the service role key from
// .env.local, never inside any app. Usage:
//
//   pnpm watchdog:run                # 90 days ending yesterday, Harare time
//   pnpm watchdog:bad-day            # same, plus a heavy skim on the last day
//   pnpm watchdog:run -- --route CODE --owner email --end 2026-07-09
//
// Both variants of the end day (normal and bad_day) are always simulated,
// scored and staged into watchdog_staged_* so the demo owner's story can
// swap the visible end day live through demo_watchdog_set_day without any
// scoring or service key leaving this pipeline.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRepoEnv } from "../lib/env.ts";
import { DEFAULT_WATCHDOG_CONFIG } from "./config.ts";
import { addDays, simulateHistory } from "./simulate.ts";
import { servedFromWatchdogMetrics, type WatchdogEngine } from "./detect.ts";
import { scoreHistory } from "./score.ts";
import { hashSeed } from "./rng.ts";
import { getNarrator } from "../adapters/language.ts";

loadRepoEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const spineRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HARARE_OFFSET_MS = 2 * 3600 * 1000;

interface CliArgs {
  routeCode: string;
  ownerEmail: string;
  endDay: string;
  badDay: boolean;
}

function yesterdayInHarare(): string {
  const today = new Date(Date.now() + HARARE_OFFSET_MS).toISOString().slice(0, 10);
  return addDays(today, -1);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    routeCode: "HEIGHTS-REZENDE",
    ownerEmail: process.env.DEMO_OWNER_EMAIL ?? "",
    endDay: yesterdayInHarare(),
    badDay: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--route") args.routeCode = argv[++i] ?? args.routeCode;
    else if (a === "--owner") args.ownerEmail = argv[++i] ?? args.ownerEmail;
    else if (a === "--end") args.endDay = argv[++i] ?? args.endDay;
    else if (a === "--bad-day") args.badDay = true;
  }
  if (!args.ownerEmail) {
    throw new Error("no owner: pass --owner <email> or set DEMO_OWNER_EMAIL");
  }
  return args;
}

function servedEngine(): WatchdogEngine {
  try {
    const raw = readFileSync(join(spineRoot, "metrics", "watchdog-metrics.json"), "utf8");
    return servedFromWatchdogMetrics(JSON.parse(raw));
  } catch {
    return "threshold:v1";
  }
}

async function ownerIdFor(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`no auth user with email ${email}; run pnpm db:seed first`);
  const { data: owner, error: oErr } = await admin
    .from("owners")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (oErr) throw new Error(`${email} has no owners row: ${oErr.message}`);
  return owner.id;
}

async function routeIdFor(code: string): Promise<string> {
  const { data, error } = await admin.from("routes").select("id").eq("code", code).single();
  if (error) throw new Error(`route ${code} not found: ${error.message}`);
  return data.id;
}

const args = parseArgs(process.argv.slice(2));
const config = DEFAULT_WATCHDOG_CONFIG;
const engine = servedEngine();
const ownerId = await ownerIdFor(args.ownerEmail);
const routeId = await routeIdFor(args.routeCode);

const scoreOptions = {
  routeCode: args.routeCode,
  engine,
  narrator: getNarrator(),
  seed: hashSeed(args.routeCode),
  contamination: config.leakRate,
};
const variants = {
  normal: simulateHistory({
    config,
    seed: hashSeed(args.routeCode),
    endDay: args.endDay,
  }),
  bad_day: simulateHistory({
    config,
    seed: hashSeed(args.routeCode),
    endDay: args.endDay,
    forceLeakOnEndDay: true,
  }),
};
const scoredVariants = {
  normal: scoreHistory(variants.normal, scoreOptions),
  bad_day: scoreHistory(variants.bad_day, scoreOptions),
};
const history = args.badDay ? variants.bad_day : variants.normal;
const scored = args.badDay ? scoredVariants.bad_day : scoredVariants.normal;

// wipe and rewrite only this owner and route's synthetic rows
for (const table of ["watchdog_day_flags", "watchdog_vehicle_days"]) {
  const { error } = await admin
    .from(table)
    .delete()
    .eq("owner_id", ownerId)
    .eq("route_id", routeId);
  if (error) throw error;
}

const vehicleRows = history.map((r) => ({
  owner_id: ownerId,
  route_id: routeId,
  vehicle_label: r.vehicleLabel,
  day: r.day,
  tickets: r.tickets,
  digital_tickets: r.digitalTickets,
  peak_tickets: r.peakTickets,
  gross_cents: r.grossCents,
  injected_leakage: r.injectedLeakage,
}));
const BATCH = 500;
for (let i = 0; i < vehicleRows.length; i += BATCH) {
  const { error } = await admin
    .from("watchdog_vehicle_days")
    .insert(vehicleRows.slice(i, i + BATCH));
  if (error) throw error;
}

const flagRow = (s: (typeof scored)[number]) => ({
  owner_id: ownerId,
  route_id: routeId,
  day: s.features.day,
  tickets: s.features.tickets,
  tickets_ratio: s.features.ticketsRatio,
  peak_share: s.features.peakShare,
  digital_share: s.features.digitalShare,
  worst_vehicle_ratio: s.features.worstVehicleRatio,
  score: s.score,
  flagged: s.flagged,
  threshold_flagged: s.thresholdFlagged,
  engine: s.engine,
  explanation_en: s.explanation?.en ?? null,
  explanation_sn: s.explanation?.sn ?? null,
  injected_leakage: s.features.injectedLeakage,
});
const { error: flagErr } = await admin
  .from("watchdog_day_flags")
  .insert(scored.map(flagRow));
if (flagErr) throw flagErr;

// stage both variants of the end day for the demo swap RPC
for (const table of ["watchdog_staged_vehicle_days", "watchdog_staged_day_flags"]) {
  const { error } = await admin
    .from(table)
    .delete()
    .eq("owner_id", ownerId)
    .eq("route_id", routeId);
  if (error) throw error;
}
for (const variant of ["normal", "bad_day"] as const) {
  const endVehicles = variants[variant]
    .filter((r) => r.day === args.endDay)
    .map((r) => ({
      owner_id: ownerId,
      route_id: routeId,
      variant,
      vehicle_label: r.vehicleLabel,
      day: r.day,
      tickets: r.tickets,
      digital_tickets: r.digitalTickets,
      peak_tickets: r.peakTickets,
      gross_cents: r.grossCents,
      injected_leakage: r.injectedLeakage,
    }));
  const { error: stagedVehErr } = await admin
    .from("watchdog_staged_vehicle_days")
    .insert(endVehicles);
  if (stagedVehErr) throw stagedVehErr;

  const endFlag = scoredVariants[variant].find((s) => s.features.day === args.endDay);
  if (!endFlag) throw new Error(`no scored end day for variant ${variant}`);
  const { error: stagedFlagErr } = await admin
    .from("watchdog_staged_day_flags")
    .insert([{ ...flagRow(endFlag), variant }]);
  if (stagedFlagErr) throw stagedFlagErr;
}

const flagged = scored.filter((s) => s.flagged);
console.log(
  `${args.routeCode}: ${scored.length} synthetic days (${vehicleRows.length} vehicle days) ` +
    `scored by ${engine}, ${flagged.length} flagged`,
);
if (args.badDay) {
  const endDay = scored.at(-1)!;
  console.log(
    `bad demo day ${endDay.features.day}: flagged=${endDay.flagged}, ` +
      `score=${endDay.score}` +
      (endDay.explanation ? `\n  ${endDay.explanation.en}` : ""),
  );
}
