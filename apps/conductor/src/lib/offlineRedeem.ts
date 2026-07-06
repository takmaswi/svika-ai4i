// The local decision engine: given the cached (hashed) codes and the local
// attempt history, decide what an entered code means with no network. Pure
// logic, no IO; the hasher is injected so tests and the app share it.
//
// The rules mirror the server exactly:
//   - expired and never-existed look identical (invalid_code, no oracle)
//   - a code this device already cleared is already_redeemed
//   - 5 failed attempts inside 10 minutes rate limits the keypad
//   - the device clock is corrected by the skew measured at last sync
export type Direction = "outbound" | "inbound";

export interface CachedCode {
  ticketId: string;
  purpose: "board" | "load" | "collect";
  codeSalt: string;
  codeHash: string;
  fareCents: number;
  paymentMethod: "wallet" | "cash";
  kind: "fare" | "parcel";
  validFromMs: number;
  validUntilMs: number;
  routeId: string;
  direction: Direction;
  /** corrected epoch ms when THIS device cleared it offline */
  consumedAt?: number;
}

export interface LocalAttempt {
  clientAttemptId: string;
  routeId: string;
  direction: Direction;
  codeEntered: string;
  outcome: "invalid_code" | "already_redeemed" | "rate_limited";
  /** corrected epoch ms */
  attemptedAt: number;
}

export type LocalDecision =
  | { outcome: "rate_limited" }
  | { outcome: "invalid_code" }
  | { outcome: "already_redeemed"; row: CachedCode }
  | { outcome: "success"; row: CachedCode; stage: "redeemed" | "loaded" | "collected" };

export const RATE_LIMIT_MAX_FAILURES = 5;
export const RATE_LIMIT_WINDOW_MS = 10 * 60_000;

/** Device clock plus the skew measured against the server at last sync. */
export function correctedNow(nowMs: number, skewMs: number): number {
  return nowMs + skewMs;
}

export function isLocallyRateLimited(
  attempts: readonly LocalAttempt[],
  nowCorrectedMs: number,
): boolean {
  const recent = attempts.filter(
    (a) => nowCorrectedMs - a.attemptedAt < RATE_LIMIT_WINDOW_MS,
  );
  return recent.length >= RATE_LIMIT_MAX_FAILURES;
}

/** What a successful clear advances the ticket to, mirroring the server. */
export function stageFor(row: CachedCode): "redeemed" | "loaded" | "collected" {
  if (row.kind === "fare") return "redeemed";
  return row.purpose === "load" ? "loaded" : "collected";
}

export async function decideLocalRedeem(args: {
  cache: readonly CachedCode[];
  attempts: readonly LocalAttempt[];
  code: string;
  nowMs: number;
  skewMs: number;
  hash: (input: string) => Promise<string>;
}): Promise<LocalDecision> {
  const now = correctedNow(args.nowMs, args.skewMs);

  if (isLocallyRateLimited(args.attempts, now)) {
    return { outcome: "rate_limited" };
  }

  // window first (an expired cached code must not answer), then the hash
  const inWindow = args.cache.filter(
    (r) => r.validFromMs <= now && r.validUntilMs > now,
  );
  for (const row of inWindow) {
    const hashed = await args.hash(row.codeSalt + args.code);
    if (hashed !== row.codeHash) continue;
    if (row.consumedAt !== undefined) {
      return { outcome: "already_redeemed", row };
    }
    return { outcome: "success", row, stage: stageFor(row) };
  }
  return { outcome: "invalid_code" };
}
