// P0 auth gate proof: sign in a seeded demo user with the ANON key (what the
// browser has), confirm the session, then resolve their role exactly the way
// the app shell does (own profile + owners/conductors under RLS). Prints the
// result and exits non-zero on any failure.
//
// Uses the demo rider's email + password because no SMS provider is wired yet;
// the product login path is phone OTP (see src/components/LoginForm.tsx). This
// proves session handling and role resolution end to end against real Supabase.
//
// Usage: pnpm auth:verify
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
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.DEMO_RIDER_EMAIL;
const PASSWORD = process.env.DEMO_RIDER_PASSWORD;
if (!URL || !ANON || !EMAIL || !PASSWORD) {
  console.error("Missing Supabase or DEMO_RIDER env for the auth proof");
  process.exit(2);
}

const supabase = createClient(URL, ANON, { auth: { persistSession: false } });

const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword(
  { email: EMAIL, password: PASSWORD },
);
if (signInErr) {
  console.error("FAIL sign in:", signInErr.message);
  process.exit(1);
}
const uid = signIn.user.id;
console.log("PASS  seeded demo user signed in");

const { data: sessionUser } = await supabase.auth.getUser();
console.log(
  sessionUser.user?.id === uid
    ? "PASS  session resolves to the signed-in user"
    : "FAIL  session mismatch",
);

const { data: profile, error: profErr } = await supabase
  .from("profiles")
  .select("full_name, phone")
  .eq("id", uid)
  .single();
console.log(
  !profErr && profile
    ? "PASS  rider reads own profile under RLS"
    : `FAIL  profile read: ${profErr?.message}`,
);

const [owner, conductor] = await Promise.all([
  supabase.from("owners").select("id").eq("profile_id", uid).maybeSingle(),
  supabase.from("conductors").select("id").eq("profile_id", uid).maybeSingle(),
]);
const role = owner.data ? "owner" : conductor.data ? "conductor" : "rider";
console.log(`PASS  role resolved: ${role}`);

console.log(
  "\n" +
    JSON.stringify(
      { signedIn: true, uid, phone: profile?.phone ?? null, role },
      null,
      2,
    ),
);
await supabase.auth.signOut();
process.exit(role === "rider" && !profErr ? 0 : 1);
