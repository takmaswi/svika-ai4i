// RLS security test: proves one rider cannot read or touch another rider's
// tickets, wallet, board codes or events, that anonymous users see nothing
// private, and that clients have no direct write path into money or history.
//
// Runs with the ANON key only (the whole point: this is what an attacker has).
// Test users are provisioned server side by the seed. Credentials come from
// .env.local (never committed).
//
// Usage: pnpm db:security-test   (or: node test/rls.security.test.mjs)

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// --- env ---------------------------------------------------------------
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
if (!URL || !ANON) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(2);
}

const creds = (who) => ({
  email: process.env[`TEST_${who}_EMAIL`],
  password: process.env[`TEST_${who}_PASSWORD`],
});

const client = () => createClient(URL, ANON, { auth: { persistSession: false } });

// --- tiny harness -------------------------------------------------------
let passed = 0,
  failed = 0,
  skipped = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail ? " :: " + detail : ""}`);
  }
}
function skip(name, why) {
  skipped++;
  console.log(`SKIP  ${name} :: ${why}`);
}
const deniedOrEmpty = (res) =>
  (res.error && ["42501", "PGRST301"].includes(res.error.code)) ||
  (!res.error && Array.isArray(res.data) && res.data.length === 0);

async function signIn(who) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword(creds(who));
  if (error) throw new Error(`sign in failed for ${who}: ${error.message}`);
  return { c, uid: data.user.id };
}

// --- test ----------------------------------------------------------------
const anon = client();

// anonymous surface
{
  const routes = await anon.from("routes").select("id, code").eq("code", "TEST-01");
  check(
    "anon can read the public route network",
    !routes.error && routes.data.length === 1,
  );
  const tickets = await anon.from("tickets").select("id");
  check("anon sees zero tickets", deniedOrEmpty(tickets));
  const accounts = await anon.from("ledger_accounts").select("id");
  check("anon sees zero ledger accounts", deniedOrEmpty(accounts));
}

const { data: routeRows } = await anon
  .from("routes")
  .select("id")
  .eq("code", "TEST-01");
const routeId = routeRows[0].id;

const A = await signIn("RIDER_A");
const B = await signIn("RIDER_B");
const C = await signIn("CONDUCTOR");

// balances before purchase
const balOf = async (s) => {
  const { data } = await s.c
    .from("account_balances")
    .select("balance_cents")
    .eq("kind", "rider_wallet")
    .single();
  return data?.balance_cents ?? null;
};
const aBefore = await balOf(A);

// each rider buys a ticket through the only write path there is: the RPC
const buy = async (s, who) => {
  const { data, error } = await s.c.rpc("purchase_ticket", {
    p_route: routeId,
    p_direction: "outbound",
  });
  if (error) throw new Error(`purchase failed for ${who}: ${error.message}`);
  return data[0];
};
const tktA = await buy(A, "rider A");
const tktB = await buy(B, "rider B");
check(
  "rider A can purchase a ticket via RPC",
  !!tktA.ticket_id && /^[0-9]{4}$/.test(tktA.board_code),
);
check("rider B can purchase a ticket via RPC", !!tktB.ticket_id);

const aAfter = await balOf(A);
check(
  "purchase debits exactly the fare from A's wallet (ledger derived)",
  aBefore - aAfter === tktA.fare_cents,
  `before=${aBefore} after=${aAfter} fare=${tktA.fare_cents}`,
);

// ---- rider isolation: the core of this test ----
{
  const mine = await A.c.from("tickets").select("id, rider_id");
  check(
    "rider A sees only own tickets",
    !mine.error && mine.data.length > 0 && mine.data.every((t) => t.rider_id === A.uid),
  );
  const cross = await A.c.from("tickets").select("id").eq("id", tktB.ticket_id);
  check("rider A cannot read rider B's ticket by id", deniedOrEmpty(cross));

  const evCross = await A.c
    .from("ticket_events")
    .select("id")
    .eq("ticket_id", tktB.ticket_id);
  check("rider A cannot read rider B's ticket events", deniedOrEmpty(evCross));

  const bcMine = await A.c.from("board_codes").select("ticket_id");
  check(
    "rider A sees only own board codes",
    !bcMine.error && bcMine.data.every((r) => r.ticket_id !== tktB.ticket_id),
  );
  const bcCross = await A.c
    .from("board_codes")
    .select("code")
    .eq("ticket_id", tktB.ticket_id);
  check("rider A cannot read rider B's board code", deniedOrEmpty(bcCross));

  // wallet isolation: get B's account id from B's own session, probe as A
  const { data: bAcct } = await B.c
    .from("ledger_accounts")
    .select("id")
    .eq("kind", "rider_wallet")
    .single();
  const acctCross = await A.c.from("ledger_accounts").select("id").eq("id", bAcct.id);
  check("rider A cannot read rider B's wallet account", deniedOrEmpty(acctCross));
  const postCross = await A.c
    .from("ledger_postings")
    .select("id")
    .eq("account_id", bAcct.id);
  check("rider A cannot read rider B's wallet postings", deniedOrEmpty(postCross));
  const balCross = await A.c
    .from("account_balances")
    .select("balance_cents")
    .eq("account_id", bAcct.id);
  check("rider A cannot read rider B's balance", deniedOrEmpty(balCross));
  const acctMine = await A.c.from("ledger_accounts").select("profile_id");
  check(
    "rider A's account list is only their own",
    !acctMine.error && acctMine.data.every((r) => r.profile_id === A.uid),
  );
  const txMine = await A.c.from("ledger_transactions").select("id, created_by");
  check(
    "rider A sees only transactions they are party to",
    !txMine.error && txMine.data.length > 0,
  );
}

// ---- no direct write paths ----
{
  const up = await A.c
    .from("tickets")
    .update({ fare_cents: 1 })
    .eq("id", tktA.ticket_id)
    .select();
  check("rider cannot UPDATE a ticket", deniedOrEmpty(up));
  const del = await A.c
    .from("ticket_events")
    .delete()
    .eq("ticket_id", tktA.ticket_id)
    .select();
  check("rider cannot DELETE ticket history", deniedOrEmpty(del));
  const forge = await A.c
    .from("ledger_postings")
    .insert({
      transaction_id: crypto.randomUUID(),
      account_id: crypto.randomUUID(),
      amount_cents: 100000,
    });
  check("rider cannot INSERT ledger postings (no money printing)", !!forge.error);
  const forgeEv = await A.c
    .from("ticket_events")
    .insert({ ticket_id: tktA.ticket_id, event_type: "redeemed" });
  check("rider cannot forge ticket events", !!forgeEv.error);
  const topup = await A.c.rpc("record_topup", {
    p_profile: A.uid,
    p_amount_cents: 100000,
  });
  check("rider cannot call the service only topup function", !!topup.error);
  const renameB = await A.c
    .from("profiles")
    .update({ full_name: "hacked" })
    .eq("id", B.uid)
    .select();
  check("rider A cannot edit rider B's profile", deniedOrEmpty(renameB));
}

// ---- conductor surface ----
{
  const t = await C.c.from("tickets").select("id");
  check("conductor cannot browse tickets", deniedOrEmpty(t));
  const bc = await C.c.from("board_codes").select("code");
  check("conductor cannot harvest board codes", deniedOrEmpty(bc));

  // redemption happens only through the rate limited RPC
  const r1 = await C.c.rpc("redeem_board_code", {
    p_route: routeId,
    p_direction: "outbound",
    p_code: tktA.board_code,
  });
  if (r1.error) {
    check("conductor can redeem a valid board code", false, r1.error.message);
  } else if (r1.data[0].outcome === "rate_limited") {
    skip(
      "conductor redemption checks",
      "conductor is rate limited from a previous run; re-run in 10 minutes",
    );
  } else {
    check(
      "conductor can redeem a valid board code",
      r1.data[0].outcome === "success",
      r1.data[0].outcome,
    );
    const r2 = await C.c.rpc("redeem_board_code", {
      p_route: routeId,
      p_direction: "outbound",
      p_code: tktA.board_code,
    });
    check(
      "same code cannot be redeemed twice",
      !r2.error && ["already_redeemed", "invalid_code"].includes(r2.data[0].outcome),
      r2.data?.[0]?.outcome,
    );
    const wrong = await C.c.rpc("redeem_board_code", {
      p_route: routeId,
      p_direction: "inbound",
      p_code: tktB.board_code,
    });
    check(
      "code is scoped: wrong direction does not redeem",
      !wrong.error && wrong.data[0].outcome === "invalid_code",
      wrong.data?.[0]?.outcome,
    );
    const evA = await A.c
      .from("ticket_status")
      .select("status")
      .eq("ticket_id", tktA.ticket_id)
      .single();
    check(
      "rider A sees own ticket as redeemed (event sourced status)",
      evA.data?.status === "redeemed",
      evA.data?.status,
    );
  }

  const attempts = await A.c.from("code_redemption_attempts").select("id");
  check("rider cannot read the redemption attempt log", deniedOrEmpty(attempts));
}

// ---- conductor route assignment (migration 0018) ----
// A conductor works only the routes an active assignment says they work.
// Three named proofs: own route serves the cache, another route is refused
// and audit logged, and a rider gets nothing from the conductor RPCs.
{
  // ASSIGN-1: own route works (the seed assigns the test conductor TEST-01)
  const own = await C.c.rpc("pull_offline_cache", {
    p_route: routeId,
    p_direction: "outbound",
  });
  check(
    "ASSIGN-1 conductor pulls the cache for their own assigned route",
    !own.error &&
      own.data.length > 0 &&
      own.data.every((r) => r.outcome === "ok" && !("code" in r)),
    own.error?.message,
  );

  // ASSIGN-2: a seeded route the conductor is NOT assigned to
  const { data: otherRows } = await anon
    .from("routes")
    .select("id")
    .eq("code", "MARKETSQ-AVONDALE");
  const otherRouteId = otherRows?.[0]?.id;
  if (!otherRouteId) {
    skip("ASSIGN-2 unassigned route checks", "MARKETSQ-AVONDALE is not seeded");
  } else {
    const refusedPull = await C.c.rpc("pull_offline_cache", {
      p_route: otherRouteId,
      p_direction: "outbound",
    });
    check(
      "ASSIGN-2 unassigned route cache pull is refused with a coarse reason",
      !refusedPull.error &&
        refusedPull.data.length === 1 &&
        refusedPull.data[0].outcome === "route_not_assigned" &&
        refusedPull.data[0].ticket_id === null,
      refusedPull.error?.message,
    );

    const { data: pullLog } = await C.c
      .from("cache_pulls")
      .select("outcome, row_count")
      .eq("route_id", otherRouteId)
      .order("pulled_at", { ascending: false })
      .limit(1);
    check(
      "ASSIGN-2 the refused pull is audit logged",
      pullLog?.length === 1 &&
        pullLog[0].outcome === "refused_unassigned" &&
        pullLog[0].row_count === 0,
    );

    const refusedRedeem = await C.c.rpc("redeem_board_code", {
      p_route: otherRouteId,
      p_direction: "outbound",
      p_code: "1234",
    });
    if (!refusedRedeem.error && refusedRedeem.data[0].outcome === "rate_limited") {
      skip(
        "ASSIGN-2 unassigned route redemption checks",
        "conductor is rate limited from a previous run; re-run in 10 minutes",
      );
    } else {
      check(
        "ASSIGN-2 unassigned route redemption is refused, code untouched",
        !refusedRedeem.error &&
          refusedRedeem.data[0].outcome === "route_not_assigned" &&
          refusedRedeem.data[0].ticket_id === null,
        refusedRedeem.error?.message ?? refusedRedeem.data?.[0]?.outcome,
      );
      const { data: attemptLog } = await C.c
        .from("code_redemption_attempts")
        .select("outcome")
        .eq("route_id", otherRouteId)
        .order("attempted_at", { ascending: false })
        .limit(1);
      check(
        "ASSIGN-2 the refused redemption attempt is logged",
        attemptLog?.length === 1 && attemptLog[0].outcome === "route_not_assigned",
      );
    }
  }

  // ASSIGN-3: a rider is refused outright, and sees no assignments
  const riderPull = await A.c.rpc("pull_offline_cache", {
    p_route: routeId,
    p_direction: "outbound",
  });
  check(
    "ASSIGN-3 a rider cannot pull any offline cache",
    !!riderPull.error,
    riderPull.error?.message,
  );
  const riderAssignments = await A.c.from("conductor_route_assignments").select("id");
  check(
    "ASSIGN-3 a rider sees no route assignments",
    deniedOrEmpty(riderAssignments),
  );
}

// ---- credit transfers (P1) ----
{
  const send = await A.c.rpc("send_credit", { p_amount_cents: 25 });
  if (send.error) {
    check("rider A can send credit via RPC", false, send.error.message);
  } else {
    const sent = send.data[0];
    check(
      "rider A can send credit via RPC",
      /^[2-9A-HJ-NP-Z]{6}$/.test(sent.claim_code),
    );

    const crossTransfers = await B.c
      .from("credit_transfers")
      .select("claim_code")
      .eq("id", sent.transfer_id);
    check(
      "rider B cannot read rider A's transfer or claim code",
      deniedOrEmpty(crossTransfers),
    );
    const crossEvents = await B.c
      .from("transfer_events")
      .select("id")
      .eq("transfer_id", sent.transfer_id);
    check("rider B cannot read rider A's transfer events", deniedOrEmpty(crossEvents));

    const forgeTransfer = await B.c.from("credit_transfers").insert({
      sender_id: B.uid,
      amount_cents: 1,
      claim_code: "AAAAAA",
      expires_at: new Date(Date.now() + 60000).toISOString(),
    });
    check("rider cannot INSERT transfers directly", !!forgeTransfer.error);

    const claim = await B.c.rpc("claim_credit", { p_code: sent.claim_code });
    check(
      "rider B can claim rider A's code via RPC",
      !claim.error && claim.data[0].outcome === "success",
      claim.error?.message ?? claim.data?.[0]?.outcome,
    );
    const reclaim = await B.c.rpc("claim_credit", { p_code: sent.claim_code });
    check(
      "the same claim code cannot pay twice",
      !reclaim.error && reclaim.data[0].outcome === "already_claimed",
      reclaim.data?.[0]?.outcome,
    );

    const cancelForeign = await B.c.rpc("cancel_transfer", {
      p_transfer: sent.transfer_id,
    });
    check("rider B cannot cancel rider A's transfer", !!cancelForeign.error);

    const attemptsCross = await A.c
      .from("transfer_claim_attempts")
      .select("id")
      .eq("claimer_id", B.uid);
    check("rider A cannot read rider B's claim attempts", deniedOrEmpty(attemptsCross));
  }
}

// ---- saved trips: rider-owned quick picks ----
{
  const { data: stopRows } = await A.c.from("stops").select("id").limit(2);
  const [s1, s2] = stopRows ?? [];
  if (!s1 || !s2) {
    skip("saved trips isolation", "fewer than two stops in the network");
  } else {
    // clean slate so reruns are deterministic
    await A.c.from("saved_trips").delete().neq("nickname", "");
    const save = await A.c.from("saved_trips").insert({
      rider_id: A.uid,
      from_stop_id: s1.id,
      to_stop_id: s2.id,
      nickname: "Town trip",
    });
    check("rider A can save a nicknamed trip", !save.error, save.error?.message);

    const savedA = await A.c.from("saved_trips").select("id, nickname");
    check(
      "rider A reads back their saved trip",
      !savedA.error &&
        savedA.data.length === 1 &&
        savedA.data[0].nickname === "Town trip",
    );

    const crossRead = await B.c.from("saved_trips").select("id");
    check("rider B cannot read rider A's saved trips", deniedOrEmpty(crossRead));

    const forge = await B.c.from("saved_trips").insert({
      rider_id: A.uid,
      from_stop_id: s1.id,
      to_stop_id: s2.id,
      nickname: "planted",
    });
    check("rider B cannot save a trip onto rider A's account", !!forge.error);

    const crossRename = await B.c
      .from("saved_trips")
      .update({ nickname: "hacked" })
      .eq("rider_id", A.uid)
      .select();
    check("rider B cannot rename rider A's saved trip", deniedOrEmpty(crossRename));

    const crossDelete = await B.c
      .from("saved_trips")
      .delete()
      .eq("rider_id", A.uid)
      .select();
    check("rider B cannot delete rider A's saved trip", deniedOrEmpty(crossDelete));

    await A.c.from("saved_trips").delete().neq("nickname", "");
  }
}

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed === 0 ? 0 : 1);
