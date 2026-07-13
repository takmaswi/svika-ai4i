// One command demo reset. Retires every demo persona's live tickets, levels
// their wallets back to the $5 float and frees the judge pool so the next judge
// starts on a clean, believable profile. Calls demo_reset_all() with the
// service role, the only place that key is used outside the seed. Nothing is
// deleted: money is append only and tickets are event sourced, so a stale
// ticket is retired with an appended 'expired' event and the per visit stats
// window moves, never a row removed.
//
//   pnpm db:demo-reset
//
// Requires migration 0030 applied to the target project.
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const file of [".env.local", ".env"]) {
  const path = join(repoRoot, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const { data, error } = await admin.rpc("demo_reset_all");
if (error) {
  console.error("demo_reset_all failed:", error.message);
  process.exit(1);
}
console.log(`demo reset: ${data} demo personas retired, judge pool freed`);
