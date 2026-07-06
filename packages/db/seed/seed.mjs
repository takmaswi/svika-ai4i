// Idempotent demo seed for rehearsal. Creates three demo people with roles and
// gives the rider some wallet credit, using the service role key (seed + CI
// only, never in app code). Safe to run repeatedly.
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
  if ((bal?.balance_cents ?? 0) > 0) return;
  const { error } = await admin.rpc("record_topup", {
    p_profile: uid,
    p_amount_cents: RIDER_TOPUP_CENTS,
  });
  if (error) throw error;
  console.log(`topped up RIDER with ${RIDER_TOPUP_CENTS}c`);
}

const ids = {};
for (const p of people) ids[p.key] = await ensureUser(p);

const ownerId = await ensureOwner(ids.OWNER, "Demo Fleet");
await ensureConductor(ids.CONDUCTOR, ownerId);
await topUpRider(ids.RIDER);

console.log("\nseed complete: rider, owner, conductor ready for rehearsal.");
