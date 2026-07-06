import { describe, it, expect } from "vitest";
import { enqueue, drainOrder, type QueuedEvent, type QueuedRedeem } from "../src/lib/offlineQueue";

let nextSeq = 1;
const redeem = (code: string, overrides: Partial<QueuedRedeem> = {}): QueuedRedeem => ({
  kind: "redeem",
  clientEventId: `evt-${code}-${overrides.seq ?? nextSeq}`,
  seq: nextSeq++,
  routeId: "route-1",
  direction: "outbound",
  code,
  ticketId: `ticket-${code}`,
  fareCents: 100,
  paymentMethod: "cash",
  stage: "redeemed",
  claimedAt: 1000,
  ...overrides,
});

describe("offline event queue", () => {
  it("queues a new redemption", () => {
    const q = enqueue([], redeem("1234"));
    expect(q).toHaveLength(1);
  });

  it("does not queue the same code twice on one device", () => {
    const q = enqueue(enqueue([], redeem("1234")), redeem("1234"));
    expect(q).toHaveLength(1);
  });

  it("does not queue the same client event id twice", () => {
    const a = redeem("1111");
    const b = { ...redeem("2222"), clientEventId: a.clientEventId };
    const q = enqueue(enqueue([], a), b);
    expect(q).toHaveLength(1);
  });

  it("same code on a different direction is a separate event", () => {
    const a = redeem("1234");
    const b = redeem("1234", { direction: "inbound", clientEventId: "evt-other" });
    const q = enqueue(enqueue([], a), b);
    expect(q).toHaveLength(2);
  });

  it("queues a change credit after its redeem and drains in that order", () => {
    const r = redeem("1234");
    const c: QueuedEvent = {
      kind: "change_credit",
      clientEventId: "evt-change",
      seq: nextSeq++,
      ticketId: r.ticketId,
      noteCents: 500,
      coveredFares: 1,
      recordedAt: 2000,
    };
    const drained = drainOrder([c, r]);
    expect(drained.map((e) => e.kind)).toEqual(["redeem", "change_credit"]);
  });

  it("drains strictly by insertion order for first-sync-wins", () => {
    const first = redeem("1111");
    const second = redeem("2222");
    expect(drainOrder([second, first]).map((e) => e.clientEventId)).toEqual([
      first.clientEventId,
      second.clientEventId,
    ]);
  });
});
