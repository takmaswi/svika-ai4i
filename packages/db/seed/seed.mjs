// Idempotent demo seed for rehearsal. Creates three demo people with roles,
// gives the rider some wallet credit, and seeds the verified Harare network
// (routes, stops, walking transfers, dated fare segments) from network.json,
// using the service role key (seed + CI only, never in app code). Safe to run
// repeatedly. Network provenance and the 2026 fare derivation are documented
// in network.json _meta; nothing here is invented.
//
// Demo users are created with email + password so rehearsal and CI can sign in
// deterministically with no SMS provider wired (the product login is phone OTP;
// these accounts also carry a phone number for when the phone provider and test
// OTP numbers are enabled). This mirrors the mock-twin rule: the demo never
// depends on a live vendor.
//
// Usage: pnpm db:seed
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const f of [".env.local", ".env"]) {
  const p = join(repoRoot, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const RIDER_TOPUP_CENTS = 1000; // $10 demo credit

const people = [
  {
    key: "RIDER",
    fullName: "Demo Rider",
    lang: "en",
    email: process.env.DEMO_RIDER_EMAIL,
    phone: process.env.DEMO_RIDER_PHONE,
    password: process.env.DEMO_RIDER_PASSWORD,
    role: "rider",
  },
  {
    key: "OWNER",
    fullName: "Demo Owner",
    lang: "en",
    email: process.env.DEMO_OWNER_EMAIL,
    phone: process.env.DEMO_OWNER_PHONE,
    password: process.env.DEMO_OWNER_PASSWORD,
    role: "owner",
  },
  {
    key: "CONDUCTOR",
    fullName: "Demo Hwindi",
    lang: "sn",
    email: process.env.DEMO_CONDUCTOR_EMAIL,
    phone: process.env.DEMO_CONDUCTOR_PHONE,
    password: process.env.DEMO_CONDUCTOR_PASSWORD,
    role: "conductor",
  },
];

async function findUserByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

async function ensureUser(p) {
  if (!p.email || !p.password) {
    throw new Error(`missing DEMO_${p.key}_EMAIL / _PASSWORD in .env.local`);
  }
  let user = await findUserByEmail(p.email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: p.email,
      password: p.password,
      email_confirm: true,
      user_metadata: { full_name: p.fullName },
    });
    if (error) throw error;
    user = data.user;
    console.log(`created ${p.key} ${p.email}`);
  } else {
    await admin.auth.admin.updateUserById(user.id, { password: p.password });
    console.log(`updated ${p.key} ${p.email}`);
  }

  // profile is created by the on-signup trigger; set the display fields
  const { error: pErr } = await admin
    .from("profiles")
    .update({ full_name: p.fullName, phone: p.phone, preferred_language: p.lang })
    .eq("id", user.id);
  if (pErr) throw pErr;
  return user.id;
}

async function ensureOwner(uid, displayName) {
  const { data } = await admin
    .from("owners")
    .select("id")
    .eq("profile_id", uid)
    .maybeSingle();
  if (data) return data.id;
  const { data: ins, error } = await admin
    .from("owners")
    .insert({ profile_id: uid, display_name: displayName })
    .select("id")
    .single();
  if (error) throw error;
  return ins.id;
}

async function ensureConductor(uid, ownerId) {
  const { data } = await admin
    .from("conductors")
    .select("id")
    .eq("profile_id", uid)
    .maybeSingle();
  if (data) return data.id;
  // commission stays 0: real rates come from fieldwork, never invented here.
  const { error } = await admin
    .from("conductors")
    .insert({ profile_id: uid, owner_id: ownerId, commission_rate_bps: 0 });
  if (error) throw error;
}

async function topUpRider(uid) {
  const { data: wallet } = await admin
    .from("ledger_accounts")
    .select("id")
    .eq("profile_id", uid)
    .eq("kind", "rider_wallet")
    .maybeSingle();
  if (!wallet) throw new Error("rider wallet was not created by the trigger");
  const { data: bal } = await admin
    .from("account_balances")
    .select("balance_cents")
    .eq("account_id", wallet.id)
    .maybeSingle();
  // refill to the demo level whenever rehearsal or e2e runs have drained the
  // wallet below one full fare; the ledger keeps the history either way
  const current = bal?.balance_cents ?? 0;
  if (current >= 500) return;
  const { error } = await admin.rpc("record_topup", {
    p_profile: uid,
    p_amount_cents: RIDER_TOPUP_CENTS - current,
    p_memo: "demo refill",
  });
  if (error) throw error;
  console.log(`topped up RIDER to ${RIDER_TOPUP_CENTS}c`);
}

// --- network -------------------------------------------------------------
const network = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "network.json"), "utf8"),
);

async function ensureStop(slug, def) {
  const { data } = await admin
    .from("stops")
    .select("id")
    .eq("name", def.name)
    .maybeSingle();
  if (data) return data.id;
  const { data: ins, error } = await admin
    .from("stops")
    .insert({ name: def.name, lat: def.lat, lng: def.lng })
    .select("id")
    .single();
  if (error) throw new Error(`stop ${slug}: ${error.message}`);
  console.log(`created stop ${def.name}`);
  return ins.id;
}

async function ensureRoute(r) {
  const { data } = await admin
    .from("routes")
    .select("id, typical_duration_minutes")
    .eq("code", r.code)
    .maybeSingle();
  if (data) {
    if (data.typical_duration_minutes !== r.typical_duration_minutes) {
      const { error } = await admin
        .from("routes")
        .update({ typical_duration_minutes: r.typical_duration_minutes })
        .eq("id", data.id);
      if (error) throw error;
    }
    return data.id;
  }
  const { data: ins, error } = await admin
    .from("routes")
    .insert({
      code: r.code,
      name: r.name,
      typical_duration_minutes: r.typical_duration_minutes,
    })
    .select("id")
    .single();
  if (error) throw new Error(`route ${r.code}: ${error.message}`);
  console.log(`created route ${r.code}`);
  return ins.id;
}

async function ensureRouteStops(routeId, stopIds) {
  const { data: existing, error: exErr } = await admin
    .from("route_stops")
    .select("direction, seq, stop_id")
    .eq("route_id", routeId)
    .order("seq");
  if (exErr) throw exErr;
  const want = [];
  stopIds.forEach((sid, i) =>
    want.push({ route_id: routeId, direction: "outbound", seq: i, stop_id: sid }),
  );
  [...stopIds]
    .reverse()
    .forEach((sid, i) =>
      want.push({ route_id: routeId, direction: "inbound", seq: i, stop_id: sid }),
    );
  const same =
    existing.length === want.length &&
    want.every((w) =>
      existing.some(
        (e) =>
          e.direction === w.direction && e.seq === w.seq && e.stop_id === w.stop_id,
      ),
    );
  if (same) return;
  if (existing.length) {
    const { error } = await admin.from("route_stops").delete().eq("route_id", routeId);
    if (error) throw error;
  }
  const { error } = await admin.from("route_stops").insert(want);
  if (error) throw error;
  console.log(`wrote stop sequence for route ${routeId}`);
}

async function ensureRouteFare(routeId, fareCents, effectiveFrom) {
  const { data } = await admin.rpc("current_fare_cents", { p_route: routeId });
  if (data === fareCents) return;
  const { error } = await admin
    .from("route_fares")
    .insert({
      route_id: routeId,
      fare_cents: fareCents,
      effective_from: effectiveFrom,
    });
  if (error) throw error;
  console.log(`route ${routeId}: end to end fare set to ${fareCents}c`);
}

async function ensureFareSegment(routeId, fromId, toId, fareCents, effectiveFrom) {
  const { data, error: selErr } = await admin
    .from("fare_segments")
    .select("id")
    .eq("route_id", routeId)
    .eq("from_stop_id", fromId)
    .eq("to_stop_id", toId)
    .eq("fare_cents", fareCents)
    .eq("effective_from", effectiveFrom)
    .maybeSingle();
  if (selErr) throw selErr;
  if (data) return;
  const { error } = await admin.from("fare_segments").insert({
    route_id: routeId,
    from_stop_id: fromId,
    to_stop_id: toId,
    fare_cents: fareCents,
    effective_from: effectiveFrom,
  });
  if (error) throw error;
}

async function ensureTransfer(tp, stopIdBySlug) {
  const fromId = stopIdBySlug[tp.from];
  const toId = stopIdBySlug[tp.to];
  const { data } = await admin
    .from("transfer_points")
    .select("id")
    .eq("from_stop_id", fromId)
    .eq("to_stop_id", toId)
    .maybeSingle();
  if (data) return;
  const { error } = await admin.from("transfer_points").insert({
    from_stop_id: fromId,
    to_stop_id: toId,
    kind: tp.kind,
    walk_meters: tp.walk_meters,
    walk_minutes: tp.walk_minutes,
    notes: tp.notes,
  });
  if (error) throw error;
  console.log(`created transfer ${tp.from} -> ${tp.to}`);
}

async function seedNetwork() {
  const effectiveFrom = network._meta.fares_effective_from;
  const stopIdBySlug = {};
  for (const [slug, def] of Object.entries(network.stops)) {
    stopIdBySlug[slug] = await ensureStop(slug, def);
  }
  for (const r of network.routes) {
    const routeId = await ensureRoute(r);
    await ensureRouteStops(
      routeId,
      r.stops.map((s) => stopIdBySlug[s]),
    );
    await ensureRouteFare(routeId, r.default_fare_cents, effectiveFrom);
    for (const seg of r.fare_segments) {
      await ensureFareSegment(
        routeId,
        stopIdBySlug[seg.from],
        stopIdBySlug[seg.to],
        seg.fare_cents,
        effectiveFrom,
      );
    }
  }
  for (const tp of network.transfers) await ensureTransfer(tp, stopIdBySlug);
  console.log("network seeded: routes, stops, transfers, dated fare segments.");
}

// the RLS test riders drain their wallets a little on every run; keep them
// funded so the security suite never fails on balance instead of security
async function refillTestRiders() {
  for (const key of ["TEST_RIDER_A_EMAIL", "TEST_RIDER_B_EMAIL"]) {
    const email = process.env[key];
    if (!email) continue;
    const user = await findUserByEmail(email);
    if (!user) continue;
    await topUpRider(user.id);
  }
}

const ids = {};
for (const p of people) ids[p.key] = await ensureUser(p);

const ownerId = await ensureOwner(ids.OWNER, "Demo Fleet");
await ensureConductor(ids.CONDUCTOR, ownerId);
await topUpRider(ids.RIDER);
await refillTestRiders();
await seedNetwork();

console.log(
  "\nseed complete: rider, owner, conductor and network ready for rehearsal.",
);
