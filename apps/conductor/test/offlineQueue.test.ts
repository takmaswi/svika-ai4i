import { describe, it, expect } from "vitest";
import {
  enqueue,
  drainOrder,
  type QueuedRedemption,
} from "../src/lib/offlineQueue";

const item = (code: string, enteredAt: number): QueuedRedemption => ({
  code,
  routeId: "route-1",
  direction: "outbound",
  enteredAt,
});

describe("offline redemption queue", () => {
  it("queues a new code", () => {
    const q = enqueue([], item("1234", 1));
    expect(q).toHaveLength(1);
  });

  it("does not queue the same code twice on one device", () => {
    const q = enqueue(enqueue([], item("1234", 1)), item("1234", 2));
    expect(q).toHaveLength(1);
  });

  it("drains oldest entry first for first-sync-wins", () => {
    const q = [item("2", 200), item("1", 100)];
    expect(drainOrder(q).map((r) => r.code)).toEqual(["1", "2"]);
  });
});
