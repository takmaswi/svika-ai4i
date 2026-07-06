// The seed of P2 offline boarding: a conductor clears fares with no signal, so
// redemptions queue locally and sync on reconnect. This is the pure queue logic,
// UI-free and testable. The conflict rule (first sync wins, second flags) is
// enforced server-side; here we only guarantee we never queue the same code
// twice on one device.

export interface QueuedRedemption {
  code: string;
  routeId: string;
  direction: "outbound" | "inbound";
  /** epoch ms the conductor entered it, kept for first-wins ordering on sync. */
  enteredAt: number;
}

/** Add a redemption unless this device already holds the same code. */
export function enqueue(
  queue: readonly QueuedRedemption[],
  item: QueuedRedemption,
): QueuedRedemption[] {
  if (queue.some((q) => q.code === item.code && q.routeId === item.routeId)) {
    return [...queue];
  }
  return [...queue, item];
}

/** Oldest first, so the earliest local entry is the one that syncs first. */
export function drainOrder(queue: readonly QueuedRedemption[]): QueuedRedemption[] {
  return [...queue].sort((a, b) => a.enteredAt - b.enteredAt);
}
