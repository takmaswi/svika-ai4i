// Ledger invariant proof, run against the live database after real flows
// (purchases, redemptions, change credits, transfers) have moved money.
//
//   I1  the whole system sums to zero: money is never created or destroyed,
//       every cent in a wallet is mirrored by the external cash boundary
//   I2  every transaction with postings is balanced (sum zero) and none has
//       exactly one posting (no single sided entries anywhere in history)
//   I3  no personal account (rider, conductor, owner) is negative
//   I4  history is append only even for the service role: UPDATE and DELETE
//       on postings and transactions are refused by trigger
//   I5  money cannot be printed: appending a one sided posting to an
//       existing balanced transaction is refused at commit
//
// Usage: node test/ledger.invariants.test.mjs
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

let passed = 0,
  failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail ? " :: " + detail : ""}`);
  }
}

// pull the full posting history (demo scale; page if it ever grows)
const postings = [];
for (let fromRow = 0; ; fromRow += 1000) {
  const { data, error } = await admin
    .from("ledger_postings")
    .select("id, transaction_id, account_id, amount_cents")
    .order("id")
    .range(fromRow, fromRow + 999);
  if (error) throw error;
  postings.push(...data);
  if (data.length < 1000) break;
}

// I1: global zero sum
const total = postings.reduce((s, p) => s + Number(p.amount_cents), 0);
check("I1 system wide posting sum is exactly zero", total === 0, `sum=${total}`);

// I2: every transaction balanced, none single sided
const byTxn = new Map();
for (const p of postings) {
  const list = byTxn.get(p.transaction_id) ?? [];
  list.push(Number(p.amount_cents));
  byTxn.set(p.transaction_id, list);
}
let unbalanced = 0,
  singleSided = 0;
for (const [, amounts] of byTxn) {
  if (amounts.length === 1) singleSided++;
  if (amounts.reduce((s, a) => s + a, 0) !== 0) unbalanced++;
}
check(
  `I2 all ${byTxn.size} transactions balance to zero`,
  unbalanced === 0,
  `${unbalanced} unbalanced`,
);
check("I2 no transaction is single sided", singleSided === 0, `${singleSided} found`);

// I3: no personal account below zero
const { data: balances, error: balErr } = await admin
  .from("account_balances")
  .select("kind, balance_cents");
if (balErr) throw balErr;
const negative = balances.filter(
  (b) =>
    ["rider_wallet", "conductor_wallet", "owner_wallet"].includes(b.kind) &&
    Number(b.balance_cents) < 0,
);
check(
  "I3 no rider, conductor or owner wallet is negative",
  negative.length === 0,
  JSON.stringify(negative),
);

// I4: append only, even for the service role
const probe = postings[0];
if (probe) {
  const upd = await admin
    .from("ledger_postings")
    .update({ amount_cents: 1 })
    .eq("id", probe.id);
  check(
    "I4 service role cannot UPDATE a posting",
    upd.error !== null && upd.error.message.includes("append only"),
    upd.error?.message ?? "update went through",
  );
  const del = await admin.from("ledger_postings").delete().eq("id", probe.id);
  check(
    "I4 service role cannot DELETE a posting",
    del.error !== null && del.error.message.includes("append only"),
    del.error?.message ?? "delete went through",
  );
  const updTxn = await admin
    .from("ledger_transactions")
    .update({ memo: "rewritten" })
    .eq("id", probe.transaction_id);
  check(
    "I4 service role cannot rewrite a transaction",
    updTxn.error !== null && updTxn.error.message.includes("append only"),
    updTxn.error?.message ?? "update went through",
  );
}

// I5: no money printing: a one sided posting is refused at commit
if (probe) {
  const forge = await admin.from("ledger_postings").insert({
    transaction_id: probe.transaction_id,
    account_id: probe.account_id,
    amount_cents: 100000,
  });
  check(
    "I5 appending an unbalancing posting is refused",
    forge.error !== null,
    forge.error?.message ?? "insert went through",
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
