// P2 offline boarding proof, run against the live database.
//
// Simulates the full offline cycle the phase gate names, from the server's
// point of view (the device pieces have their own unit tests in
// apps/conductor):
//
//   O1  the cache pull is hashes only: no plaintext code leaves the server,
//       and the salted hash matches what the device would compute
//   O2  a queued offline redemption syncs, settles the ledger exactly like
//       an online redemption, and the ticket's event history records the
//       offline claim
//   O3  replaying the same queued event (a queue that dropped mid-flush and
//       started over) changes nothing: same answer, zero new money movement
//   O4  the same code synced from a second device resolves first sync wins:
//       'already_redeemed', an anomaly flag for the owner, no double spend
//   O5  a claimed time in the device's future is clamped, flagged, and still
//       settles once (clock skew does not lose the fare or double it)
//   O6  a stale replay (claimed over 7 days ago) is refused with money
//       untouched
//   O7  change to credit recorded offline syncs once: the rider is credited
//       exactly once across replay and a duplicate from another device
//   O8  after all of it the whole ledger still sums to zero
//
// Reruns note: O4 and O6 each log one failed attempt for the test conductor;
// the shared rate limiter allows 5 failures per 10 minutes, so this suite
// stays well inside the budget even next to the RLS suite.
//
// Usage: node test/offline.sync.test.mjs
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
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
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error("Missing Supabase env (URL / anon / service role)");
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

async function signIn(email, password) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in ${email} failed: ${error.message}`);
  return c;
}

function sha256Hex(s) {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// the two "devices" are two independent sessions of the same conductor
const rider = await signIn(
  process.env.TEST_RIDER_A_EMAIL,
  process.env.TEST_RIDER_A_PASSWORD,
);
const deviceA = await signIn(
  process.env.TEST_CONDUCTOR_EMAIL,
  process.env.TEST_CONDUCTOR_PASSWORD,
);
const deviceB = await signIn(
  process.env.TEST_CONDUCTOR_EMAIL,
  process.env.TEST_CONDUCTOR_PASSWORD,
);

const riderId = (await rider.auth.getUser()).data.user.id;
const conductorProfileId = (await deviceA.auth.getUser()).data.user.id;

const { data: route } = await rider
  .from("routes")
  .select("id")
  .eq("code", "HEIGHTS-REZENDE")
  .single();
const routeId = route.id;

const { data: conductorRow } = await admin
  .from("conductors")
  .select("id, owner_id")
  .eq("profile_id", conductorProfileId)
  .single();

// keep the rider funded for two wallet fares
{
  const { data: bal } = await admin
    .from("account_balances")
    .select("balance_cents")
    .eq("profile_id", riderId)
    .eq("kind", "rider_wallet")
    .single();
  if ((bal?.balance_cents ?? 0) < 600) {
    const { error } = await admin.rpc("record_topup", {
      p_profile: riderId,
      p_amount_cents: 1000,
      p_memo: "offline test refill",
    });
    if (error) throw new Error(`topup failed: ${error.message}`);
  }
}

async function buyTicket(payment) {
  const { data, error } = await rider.rpc("purchase_ticket", {
    p_route: routeId,
    p_direction: "outbound",
    p_payment: payment,
  });
  if (error) throw new Error(`purchase failed: ${error.message}`);
  return data[0]; // { ticket_id, board_code, fare_cents, valid_until }
}

async function settlementTxns(ticketId) {
  const { data } = await admin
    .from("ledger_transactions")
    .select("id")
    .eq("ticket_id", ticketId)
    .eq("kind", "fare_settlement");
  return data ?? [];
}

async function postingsFor(txnIds) {
  if (txnIds.length === 0) return [];
  const { data } = await admin
    .from("ledger_postings")
    .select("account_id, amount_cents, transaction_id")
    .in("transaction_id", txnIds);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// O1: the cache pull holds hashes, not codes
// ---------------------------------------------------------------------------
const t1 = await buyTicket("wallet");

const { data: cacheRows, error: pullErr } = await deviceA.rpc("pull_offline_cache", {
  p_route: routeId,
  p_direction: "outbound",
});
check("O1 cache pull succeeds for the conductor", !pullErr, pullErr?.message);

const t1row = (cacheRows ?? []).find((r) => r.ticket_id === t1.ticket_id);
check("O1 pending ticket is in the cache pull", Boolean(t1row));
check(
  "O1 no plaintext code field anywhere in the payload",
  (cacheRows ?? []).every((r) => !("code" in r) && !("board_code" in r)),
);
check(
  "O1 salted hash matches sha256(salt || code)",
  t1row && t1row.code_hash === sha256Hex(t1row.code_salt + t1.board_code),
);
check(
  "O1 cache row carries fare, payment and window",
  t1row &&
    t1row.fare_cents === t1.fare_cents &&
    t1row.payment_method === "wallet" &&
    Boolean(t1row.valid_until) &&
    Boolean(t1row.server_time),
);

{
  const { data: pulls } = await deviceA
    .from("cache_pulls")
    .select("row_count")
    .order("pulled_at", { ascending: false })
    .limit(1);
  check("O1 the pull is audit logged and visible to its conductor", (pulls ?? []).length === 1);
}

// ---------------------------------------------------------------------------
// O2: offline redemption syncs and settles once
// ---------------------------------------------------------------------------
const e1 = randomUUID();
const claimedAt = new Date().toISOString();

const { data: s1, error: s1err } = await deviceA.rpc("sync_offline_redemption", {
  p_client_event_id: e1,
  p_route: routeId,
  p_direction: "outbound",
  p_code: t1.board_code,
  p_redeemed_at: claimedAt,
});
check("O2 offline redemption syncs as success", !s1err && s1?.[0]?.outcome === "success", s1err?.message);
check(
  "O2 sync returns fare and stage like online redeem",
  s1?.[0]?.fare_cents === t1.fare_cents && s1?.[0]?.stage === "redeemed" && s1?.[0]?.flagged === false,
);

{
  const { data: status } = await rider
    .from("ticket_status")
    .select("status")
    .eq("ticket_id", t1.ticket_id)
    .single();
  check("O2 rider sees the ticket redeemed after sync", status?.status === "redeemed");

  const txns = await settlementTxns(t1.ticket_id);
  check("O2 exactly one settlement transaction", txns.length === 1);

  const posts = await postingsFor(txns.map((t) => t.id));
  const sum = posts.reduce((a, p) => a + p.amount_cents, 0);
  check("O2 settlement is balanced double entry", posts.length >= 2 && sum === 0);

  const { data: ev } = await admin
    .from("ticket_events")
    .select("event_type, detail")
    .eq("ticket_id", t1.ticket_id)
    .eq("event_type", "redeemed");
  check(
    "O2 event history records the offline claim",
    ev?.length === 1 &&
      ev[0].detail.offline === true &&
      ev[0].detail.client_event_id === e1 &&
      Boolean(ev[0].detail.claimed_at) &&
      Boolean(ev[0].detail.synced_at),
  );
}

// ---------------------------------------------------------------------------
// O3: replaying the same event is a no-op (mid-flush drop, then full replay)
// ---------------------------------------------------------------------------
{
  const before = await postingsFor((await settlementTxns(t1.ticket_id)).map((t) => t.id));

  const { data: s2 } = await deviceA.rpc("sync_offline_redemption", {
    p_client_event_id: e1,
    p_route: routeId,
    p_direction: "outbound",
    p_code: t1.board_code,
    p_redeemed_at: claimedAt,
  });
  check(
    "O3 replayed event returns the same success receipt",
    s2?.[0]?.outcome === "success" && s2?.[0]?.fare_cents === t1.fare_cents,
  );

  const txns = await settlementTxns(t1.ticket_id);
  const after = await postingsFor(txns.map((t) => t.id));
  check(
    "O3 replay moved no money (same txn, same postings)",
    txns.length === 1 && after.length === before.length,
  );

  const { data: ev } = await admin
    .from("ticket_events")
    .select("id")
    .eq("ticket_id", t1.ticket_id)
    .eq("event_type", "redeemed");
  check("O3 replay appended no second redeemed event", ev?.length === 1);
}

// ---------------------------------------------------------------------------
// O5 first (keeps failed attempts after the success paths): future clock
// ---------------------------------------------------------------------------
const t2 = await buyTicket("wallet");
{
  const e3 = randomUUID();
  const future = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { data: s3 } = await deviceA.rpc("sync_offline_redemption", {
    p_client_event_id: e3,
    p_route: routeId,
    p_direction: "outbound",
    p_code: t2.board_code,
    p_redeemed_at: future,
  });
  check(
    "O5 future claimed time still settles once but is flagged",
    s3?.[0]?.outcome === "success" && s3?.[0]?.flagged === true,
  );
  const txns = await settlementTxns(t2.ticket_id);
  check("O5 exactly one settlement for the skewed ticket", txns.length === 1);

  const { data: flags } = await admin
    .from("anomaly_flags")
    .select("kind, owner_id")
    .eq("kind", "clock_skew")
    .order("created_at", { ascending: false })
    .limit(1);
  check(
    "O5 clock skew anomaly flag written for the owner",
    flags?.length === 1 && flags[0].owner_id === conductorRow.owner_id,
  );
}

// ---------------------------------------------------------------------------
// O7: cash fare redeemed offline, change to credit synced exactly once
// ---------------------------------------------------------------------------
const t3 = await buyTicket("cash");
{
  const eRedeem = randomUUID();
  const { data: s } = await deviceA.rpc("sync_offline_redemption", {
    p_client_event_id: eRedeem,
    p_route: routeId,
    p_direction: "outbound",
    p_code: t3.board_code,
    p_redeemed_at: new Date().toISOString(),
  });
  check(
    "O7 cash ticket redeems offline (no wallet settlement)",
    s?.[0]?.outcome === "success" && s?.[0]?.payment_method === "cash",
  );
  const txns = await settlementTxns(t3.ticket_id);
  check("O7 cash redemption moved no ledger money", txns.length === 0);

  const balBefore = (
    await admin
      .from("account_balances")
      .select("balance_cents")
      .eq("profile_id", riderId)
      .eq("kind", "rider_wallet")
      .single()
  ).data.balance_cents;

  const noteCents = 500;
  const expectedChange = noteCents - t3.fare_cents;
  const eChange = randomUUID();

  const { data: c1, error: c1err } = await deviceA.rpc("sync_offline_change_credit", {
    p_client_event_id: eChange,
    p_ticket: t3.ticket_id,
    p_note_cents: noteCents,
    p_covered_fares: 1,
    p_recorded_at: new Date().toISOString(),
  });
  check(
    "O7 offline change credit settles after the fact",
    !c1err && c1?.[0]?.outcome === "success" && c1?.[0]?.change_cents === expectedChange,
    c1err?.message,
  );

  // replay of the same change event: same answer, no second credit
  const { data: c2 } = await deviceA.rpc("sync_offline_change_credit", {
    p_client_event_id: eChange,
    p_ticket: t3.ticket_id,
    p_note_cents: noteCents,
    p_covered_fares: 1,
    p_recorded_at: new Date().toISOString(),
  });
  check(
    "O7 replayed change event returns the receipt, credits nothing",
    c2?.[0]?.outcome === "success" && c2?.[0]?.change_cents === expectedChange,
  );

  // a second device recorded the same change offline: rejected + flagged
  const { data: c3 } = await deviceB.rpc("sync_offline_change_credit", {
    p_client_event_id: randomUUID(),
    p_ticket: t3.ticket_id,
    p_note_cents: noteCents,
    p_covered_fares: 1,
    p_recorded_at: new Date().toISOString(),
  });
  check("O7 duplicate change from a second device is rejected", c3?.[0]?.outcome === "rejected");

  const balAfter = (
    await admin
      .from("account_balances")
      .select("balance_cents")
      .eq("profile_id", riderId)
      .eq("kind", "rider_wallet")
      .single()
  ).data.balance_cents;
  check(
    "O7 rider was credited the change exactly once",
    balAfter - balBefore === expectedChange,
  );

  const { data: flags } = await admin
    .from("anomaly_flags")
    .select("id")
    .eq("kind", "offline_duplicate_change")
    .eq("ticket_id", t3.ticket_id);
  check("O7 duplicate change anomaly flag written", (flags?.length ?? 0) === 1);
}

// ---------------------------------------------------------------------------
// O4: the conflict. Same code from a second device: first sync wins.
// ---------------------------------------------------------------------------
{
  const e2 = randomUUID();
  const { data: s } = await deviceB.rpc("sync_offline_redemption", {
    p_client_event_id: e2,
    p_route: routeId,
    p_direction: "outbound",
    p_code: t1.board_code,
    p_redeemed_at: claimedAt,
  });
  check(
    "O4 second device gets already_redeemed and a flag",
    s?.[0]?.outcome === "already_redeemed" && s?.[0]?.flagged === true,
  );

  const txns = await settlementTxns(t1.ticket_id);
  check("O4 still exactly one settlement transaction", txns.length === 1);

  const { data: flags } = await admin
    .from("anomaly_flags")
    .select("kind, owner_id, detail")
    .eq("kind", "offline_duplicate_redemption")
    .eq("ticket_id", t1.ticket_id);
  check(
    "O4 duplicate redemption flag names the pattern, scoped to the owner",
    flags?.length === 1 &&
      flags[0].owner_id === conductorRow.owner_id &&
      Boolean(flags[0].detail.first_conductor_id) &&
      Boolean(flags[0].detail.refused_conductor_id),
  );

  const { data: ev } = await admin
    .from("ticket_events")
    .select("id")
    .eq("ticket_id", t1.ticket_id)
    .eq("event_type", "redeemed");
  check("O4 event history still holds a single redemption", ev?.length === 1);
}

// ---------------------------------------------------------------------------
// O6: a stale replay is refused, money untouched
// ---------------------------------------------------------------------------
{
  const before = (
    await admin.from("ledger_postings").select("id", { count: "exact", head: true })
  ).count;

  const { data: s } = await deviceA.rpc("sync_offline_redemption", {
    p_client_event_id: randomUUID(),
    p_route: routeId,
    p_direction: "outbound",
    p_code: "0000",
    p_redeemed_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
  });
  check("O6 stale offline event refused as sync_expired", s?.[0]?.outcome === "sync_expired");

  const after = (
    await admin.from("ledger_postings").select("id", { count: "exact", head: true })
  ).count;
  check("O6 stale replay moved no money", before === after);
}

// ---------------------------------------------------------------------------
// offline attempt log: failed entries sync for the audit trail, deduped
// ---------------------------------------------------------------------------
{
  const attemptId = randomUUID();
  const batch = [
    {
      client_attempt_id: attemptId,
      route_id: routeId,
      direction: "outbound",
      code_entered: "9999",
      outcome: "invalid_code",
      attempted_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
  ];
  const { error: l1err } = await deviceA.rpc("log_offline_attempts", { p_attempts: batch });
  const { error: l2err } = await deviceA.rpc("log_offline_attempts", { p_attempts: batch });
  const { data: logged } = await admin
    .from("code_redemption_attempts")
    .select("id")
    .eq("client_attempt_id", attemptId);
  check(
    "attempt log syncs once even when replayed",
    !l1err && !l2err && logged?.length === 1,
    l1err?.message ?? l2err?.message,
  );

  const { error: badErr } = await deviceA.rpc("log_offline_attempts", {
    p_attempts: [{ client_attempt_id: randomUUID(), code_entered: "1111", outcome: "success" }],
  });
  check("attempt log refuses client-claimed success", Boolean(badErr));
}

// ---------------------------------------------------------------------------
// O8: the whole ledger still sums to zero
// ---------------------------------------------------------------------------
{
  const postings = [];
  for (let fromRow = 0; ; fromRow += 1000) {
    const { data, error } = await admin
      .from("ledger_postings")
      .select("amount_cents")
      .order("id")
      .range(fromRow, fromRow + 999);
    if (error) throw error;
    postings.push(...data);
    if (data.length < 1000) break;
  }
  const total = postings.reduce((a, p) => a + p.amount_cents, 0);
  check(`O8 ledger sums to zero over ${postings.length} postings`, total === 0, `sum=${total}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
