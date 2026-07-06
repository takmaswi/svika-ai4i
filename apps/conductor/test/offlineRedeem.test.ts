import { describe, it, expect } from "vitest";
import { sha256Hex } from "../src/lib/hash";
import {
  decideLocalRedeem,
  isLocallyRateLimited,
  correctedNow,
  stageFor,
  RATE_LIMIT_MAX_FAILURES,
  RATE_LIMIT_WINDOW_MS,
  type CachedCode,
  type LocalAttempt,
} from "../src/lib/offlineRedeem";

const NOW = 1_750_000_000_000;

async function cachedRow(
  code: string,
  overrides: Partial<CachedCode> = {},
): Promise<CachedCode> {
  const codeSalt = `salt-${code}`;
  return {
    ticketId: `ticket-${code}`,
    purpose: "board",
    codeSalt,
    codeHash: await sha256Hex(codeSalt + code),
    fareCents: 100,
    paymentMethod: "cash",
    kind: "fare",
    validFromMs: NOW - 60_000,
    validUntilMs: NOW + 60 * 60_000,
    routeId: "route-1",
    direction: "outbound",
    ...overrides,
  };
}

const attempt = (attemptedAt: number): LocalAttempt => ({
  clientAttemptId: `att-${attemptedAt}`,
  routeId: "route-1",
  direction: "outbound",
  codeEntered: "0000",
  outcome: "invalid_code",
  attemptedAt,
});

const decide = (
  cache: CachedCode[],
  code: string,
  extra: Partial<Parameters<typeof decideLocalRedeem>[0]> = {},
) =>
  decideLocalRedeem({
    cache,
    attempts: [],
    code,
    nowMs: NOW,
    skewMs: 0,
    hash: sha256Hex,
    ...extra,
  });

describe("sha256Hex", () => {
  it("matches the known SHA-256 vector", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("local redeem decision", () => {
  it("clears a valid cached code", async () => {
    const row = await cachedRow("1234");
    const d = await decide([row], "1234");
    expect(d.outcome).toBe("success");
    if (d.outcome === "success") {
      expect(d.row.ticketId).toBe(row.ticketId);
      expect(d.stage).toBe("redeemed");
    }
  });

  it("a wrong code is invalid, even with a near miss in cache", async () => {
    const d = await decide([await cachedRow("1234")], "1235");
    expect(d.outcome).toBe("invalid_code");
  });

  it("a code this device already cleared is already_redeemed", async () => {
    const row = await cachedRow("1234", { consumedAt: NOW - 5_000 });
    const d = await decide([row], "1234");
    expect(d.outcome).toBe("already_redeemed");
  });

  it("an expired cached code looks exactly like a wrong code (no oracle)", async () => {
    const row = await cachedRow("1234", { validUntilMs: NOW - 1 });
    const d = await decide([row], "1234");
    expect(d.outcome).toBe("invalid_code");
  });

  it("a not yet valid code is refused the same way", async () => {
    const row = await cachedRow("1234", { validFromMs: NOW + 60_000 });
    const d = await decide([row], "1234");
    expect(d.outcome).toBe("invalid_code");
  });

  it("skew correction: a device clock running behind still honours expiry", async () => {
    // code expired 1 minute ago in server time; device clock is 5 min behind
    const row = await cachedRow("1234", { validUntilMs: NOW - 60_000 });
    const d = await decide([row], "1234", { nowMs: NOW - 5 * 60_000, skewMs: 5 * 60_000 });
    expect(d.outcome).toBe("invalid_code");
  });

  it("skew correction: a device clock running ahead does not kill a live code", async () => {
    const row = await cachedRow("1234", { validUntilMs: NOW + 60_000 });
    const d = await decide([row], "1234", { nowMs: NOW + 5 * 60_000, skewMs: -5 * 60_000 });
    expect(d.outcome).toBe("success");
  });

  it("rate limits after 5 failures inside 10 minutes", async () => {
    const attempts = Array.from({ length: RATE_LIMIT_MAX_FAILURES }, (_, i) =>
      attempt(NOW - i * 1000),
    );
    const d = await decide([await cachedRow("1234")], "1234", { attempts });
    expect(d.outcome).toBe("rate_limited");
  });

  it("old failures fall out of the rate window", async () => {
    const attempts = Array.from({ length: RATE_LIMIT_MAX_FAILURES }, (_, i) =>
      attempt(NOW - RATE_LIMIT_WINDOW_MS - i * 1000),
    );
    const d = await decide([await cachedRow("1234")], "1234", { attempts });
    expect(d.outcome).toBe("success");
  });

  it("parcel stages mirror the server", async () => {
    const load = await cachedRow("2222", { kind: "parcel", purpose: "load" });
    const collect = await cachedRow("3333", { kind: "parcel", purpose: "collect" });
    expect(stageFor(load)).toBe("loaded");
    expect(stageFor(collect)).toBe("collected");
  });
});

describe("clock helpers", () => {
  it("corrects the device clock by the measured skew", () => {
    expect(correctedNow(1000, 250)).toBe(1250);
  });

  it("rate limiting uses the corrected clock", () => {
    const attempts = Array.from({ length: RATE_LIMIT_MAX_FAILURES }, (_, i) =>
      attempt(NOW - i * 1000),
    );
    expect(isLocallyRateLimited(attempts, NOW)).toBe(true);
    expect(isLocallyRateLimited(attempts, NOW + RATE_LIMIT_WINDOW_MS)).toBe(false);
  });
});
