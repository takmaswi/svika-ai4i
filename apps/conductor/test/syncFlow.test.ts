// The device half of the offline cycle: queue persistence, consumed marker
// survival across cache refreshes, and the flush rules (in order, stop on
// error, remove only on a server verdict). The server half is proven live in
// packages/db/test/offline.sync.test.mjs.
import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CachedCode } from "../src/lib/offlineRedeem";
import type { QueuedRedeem, QueuedChangeCredit } from "../src/lib/offlineQueue";
import * as store from "../src/lib/offlineStore";
import { flushQueue, pullCache } from "../src/lib/sync";

const row = (code: string, overrides: Partial<CachedCode> = {}): CachedCode => ({
  ticketId: `ticket-${code}`,
  purpose: "board",
  codeSalt: `salt-${code}`,
  codeHash: `hash-${code}`,
  fareCents: 100,
  paymentMethod: "cash",
  kind: "fare",
  validFromMs: 0,
  validUntilMs: 10_000_000,
  routeId: "route-1",
  direction: "outbound",
  ...overrides,
});

const redeemEvent = (code: string, seq: number): QueuedRedeem => ({
  kind: "redeem",
  clientEventId: `evt-${code}`,
  seq,
  routeId: "route-1",
  direction: "outbound",
  code,
  ticketId: `ticket-${code}`,
  fareCents: 100,
  paymentMethod: "cash",
  stage: "redeemed",
  claimedAt: 1000 + seq,
});

const changeEvent = (ticket: string, seq: number): QueuedChangeCredit => ({
  kind: "change_credit",
  clientEventId: `evt-change-${ticket}`,
  seq,
  ticketId: `ticket-${ticket}`,
  noteCents: 500,
  coveredFares: 1,
  recordedAt: 2000 + seq,
});

/** a supabase stand-in whose rpc answers from a script, in call order */
function fakeSupabase(script: Array<{ data?: unknown; error?: unknown }>) {
  const rpc = vi.fn(
    async (..._args: unknown[]) =>
      script.shift() ?? { data: null, error: { message: "off script" } },
  );
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

async function clearAll() {
  await store.replaceCache([]);
  for (const ev of await store.listQueue()) await store.removeEvent(ev.clientEventId);
  await store.removeAttempts((await store.listAttempts()).map((a) => a.clientAttemptId));
}

beforeEach(clearAll);

describe("offline store", () => {
  it("round trips the code cache", async () => {
    await store.replaceCache([row("1111"), row("2222")]);
    const cache = await store.getCache();
    expect(cache).toHaveLength(2);
  });

  it("keeps the consumed marker across a cache refresh", async () => {
    await store.replaceCache([row("1111")]);
    await store.markConsumed({ ticketId: "ticket-1111", purpose: "board" }, 5000);
    // a new pull still lists the ticket (its sync is queued, server not told yet)
    await store.replaceCache([row("1111")]);
    const cache = await store.getCache();
    expect(cache[0]?.consumedAt).toBe(5000);
  });

  it("drops markers for tickets the server no longer lists", async () => {
    await store.replaceCache([row("1111")]);
    await store.markConsumed({ ticketId: "ticket-1111", purpose: "board" }, 5000);
    await store.replaceCache([row("3333")]);
    const cache = await store.getCache();
    expect(cache).toHaveLength(1);
    expect(cache[0]?.ticketId).toBe("ticket-3333");
  });

  it("hands out monotonic sequence numbers", async () => {
    const a = await store.nextSeq();
    const b = await store.nextSeq();
    expect(b).toBeGreaterThan(a);
  });
});

describe("flushQueue", () => {
  it("replays events in order and clears the queue on server verdicts", async () => {
    await store.putEvent(redeemEvent("1111", 1));
    await store.putEvent(changeEvent("1111", 2));
    const { client, rpc } = fakeSupabase([
      { data: [{ outcome: "success", flagged: false }], error: null },
      { data: [{ outcome: "success", change_cents: 400 }], error: null },
    ]);

    const summary = await flushQueue(client);

    expect(summary.blocked).toBe(false);
    expect(summary.results.map((r) => r.outcome)).toEqual(["success", "success"]);
    expect(await store.listQueue()).toHaveLength(0);
    // redeem replayed before the change for the same ticket
    expect(rpc.mock.calls[0]?.[0]).toBe("sync_offline_redemption");
    expect(rpc.mock.calls[1]?.[0]).toBe("sync_offline_change_credit");
  });

  it("an already_redeemed verdict clears the event and reports the flag", async () => {
    await store.putEvent(redeemEvent("1111", 1));
    const { client } = fakeSupabase([
      { data: [{ outcome: "already_redeemed", flagged: true }], error: null },
    ]);

    const summary = await flushQueue(client);

    expect(summary.results[0]?.outcome).toBe("already_redeemed");
    expect(summary.results[0]?.flagged).toBe(true);
    expect(await store.listQueue()).toHaveLength(0);
  });

  it("a transport error keeps the event queued and stops the flush", async () => {
    await store.putEvent(redeemEvent("1111", 1));
    await store.putEvent(redeemEvent("2222", 2));
    const { client, rpc } = fakeSupabase([
      { data: null, error: { message: "Failed to fetch" } },
    ]);

    const summary = await flushQueue(client);

    expect(summary.blocked).toBe(true);
    expect(summary.results).toHaveLength(0);
    expect(await store.listQueue()).toHaveLength(2);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("a mid-flush drop keeps only the unsynced tail queued", async () => {
    await store.putEvent(redeemEvent("1111", 1));
    await store.putEvent(redeemEvent("2222", 2));
    const { client } = fakeSupabase([
      { data: [{ outcome: "success", flagged: false }], error: null },
      { data: null, error: { message: "Failed to fetch" } },
    ]);

    const summary = await flushQueue(client);

    expect(summary.blocked).toBe(true);
    expect(summary.results).toHaveLength(1);
    const left = await store.listQueue();
    expect(left).toHaveLength(1);
    expect(left[0]?.clientEventId).toBe("evt-2222");
  });

  it("rate_limited stops the flush and keeps the event for retry", async () => {
    await store.putEvent(redeemEvent("1111", 1));
    const { client } = fakeSupabase([
      { data: [{ outcome: "rate_limited", flagged: false }], error: null },
    ]);

    const summary = await flushQueue(client);

    expect(summary.blocked).toBe(true);
    expect(await store.listQueue()).toHaveLength(1);
  });

  it("syncs and clears the failed attempt log after the queue", async () => {
    await store.addAttempt({
      clientAttemptId: "att-1",
      routeId: "route-1",
      direction: "outbound",
      codeEntered: "9999",
      outcome: "invalid_code",
      attemptedAt: 1000,
    });
    const { client, rpc } = fakeSupabase([{ data: 1, error: null }]);

    const summary = await flushQueue(client);

    expect(summary.blocked).toBe(false);
    expect(rpc.mock.calls[0]?.[0]).toBe("log_offline_attempts");
    expect(await store.listAttempts()).toHaveLength(0);
  });

  it("keeps the attempt log when its sync fails", async () => {
    await store.addAttempt({
      clientAttemptId: "att-1",
      routeId: "route-1",
      direction: "outbound",
      codeEntered: "9999",
      outcome: "invalid_code",
      attemptedAt: 1000,
    });
    const { client } = fakeSupabase([{ data: null, error: { message: "boom" } }]);

    await flushQueue(client);

    expect(await store.listAttempts()).toHaveLength(1);
  });
});

describe("pullCache", () => {
  const pullRow = (ticket: string) => ({
    outcome: "ok",
    ticket_id: ticket,
    purpose: "board",
    code_salt: "salt",
    code_hash: "hash",
    fare_cents: 100,
    payment_method: "cash",
    kind: "fare",
    valid_from: new Date(0).toISOString(),
    valid_until: new Date(10_000_000).toISOString(),
    server_time: new Date().toISOString(),
  });

  it("stores ok rows as the local cache", async () => {
    const { client } = fakeSupabase([
      { data: [pullRow("ticket-a"), pullRow("ticket-b")], error: null },
    ]);

    const result = await pullCache(client, "route-1", "outbound");

    expect(result?.rows).toBe(2);
    expect(result?.refused).toBeUndefined();
    expect(await store.getCache()).toHaveLength(2);
  });

  it("a route_not_assigned refusal clears the cache and reports it", async () => {
    await store.replaceCache([row("1111")]);
    const { client } = fakeSupabase([
      {
        data: [{ outcome: "route_not_assigned", ticket_id: null, server_time: new Date().toISOString() }],
        error: null,
      },
    ]);

    const result = await pullCache(client, "route-1", "outbound");

    expect(result?.refused).toBe(true);
    expect(result?.rows).toBe(0);
    expect(await store.getCache()).toHaveLength(0);
  });

  it("a transport error keeps the old cache", async () => {
    await store.replaceCache([row("1111")]);
    const { client } = fakeSupabase([
      { data: null, error: { message: "Failed to fetch" } },
    ]);

    const result = await pullCache(client, "route-1", "outbound");

    expect(result).toBeNull();
    expect(await store.getCache()).toHaveLength(1);
  });
});
