// The USSD menu engine behind the Gogo vision scene: real, tested code that
// waits on a telco aggregator agreement, not a build. Pure state machine;
// every outside touch (wallet reads, booking, eta, claiming) goes through an
// injected UssdEffects adapter, so the vision scene wires the mock money twin
// and the real eta endpoint without the machine knowing which is which.

/** The short code the phone dials. Placeholder until an aggregator assigns one. */
export const USSD_CODE = "*123#";

const CLAIM_CODE_SHAPE = /^\d{4}$/;

export interface UssdEffects {
  balanceCents(): Promise<number>;
  bookUsualTrip(): Promise<{ routeName: string; code: string; fareCents: number }>;
  kombiEta(): Promise<{ minutes: number; isMock: boolean }>;
  claimChange(
    code: string,
  ): Promise<{ ok: true; balanceCents: number } | { ok: false }>;
}

/** Where an open session sits. USSD keeps almost nothing between inputs. */
export interface UssdSession {
  screen: "menu" | "claim-code";
}

/** One rendered reply: CON keeps the session open, END closes it. */
export type UssdReply =
  | { kind: "con"; id: "menu"; error?: "invalid" }
  | { kind: "con"; id: "claim-code"; error?: "invalid" }
  | { kind: "end"; id: "balance"; balanceCents: number }
  | { kind: "end"; id: "booked"; routeName: string; code: string; fareCents: number }
  | { kind: "end"; id: "eta"; minutes: number; isMock: boolean }
  | { kind: "end"; id: "claimed"; balanceCents: number }
  | { kind: "end"; id: "claim-rejected" }
  | { kind: "end"; id: "unavailable" };

export interface UssdStep {
  /** Null once the reply is an END screen: the phone must dial again. */
  session: UssdSession | null;
  reply: UssdReply;
}

/** Dialling the short code: a fresh session on the main menu. */
export function startUssd(): UssdStep {
  return { session: { screen: "menu" }, reply: { kind: "con", id: "menu" } };
}

/** One user input against an open session. Never mutates the session. */
export async function ussdInput(
  session: UssdSession,
  input: string,
  effects: UssdEffects,
): Promise<UssdStep> {
  try {
    if (session.screen === "menu") return await menuInput(input, effects);
    return await claimInput(input, effects);
  } catch {
    return end({ kind: "end", id: "unavailable" });
  }
}

async function menuInput(input: string, effects: UssdEffects): Promise<UssdStep> {
  switch (input) {
    case "1": {
      const balanceCents = await effects.balanceCents();
      return end({ kind: "end", id: "balance", balanceCents });
    }
    case "2": {
      const booked = await effects.bookUsualTrip();
      return end({ kind: "end", id: "booked", ...booked });
    }
    case "3": {
      const eta = await effects.kombiEta();
      return end({ kind: "end", id: "eta", ...eta });
    }
    case "4":
      return con("claim-code");
    default:
      return con("menu", "invalid");
  }
}

async function claimInput(input: string, effects: UssdEffects): Promise<UssdStep> {
  if (input === "0") return con("menu");
  if (!CLAIM_CODE_SHAPE.test(input)) return con("claim-code", "invalid");
  const claimed = await effects.claimChange(input);
  if (!claimed.ok) return end({ kind: "end", id: "claim-rejected" });
  return end({ kind: "end", id: "claimed", balanceCents: claimed.balanceCents });
}

function con(screen: "menu" | "claim-code", error?: "invalid"): UssdStep {
  return {
    session: { screen },
    reply: error ? { kind: "con", id: screen, error } : { kind: "con", id: screen },
  };
}

function end(reply: UssdReply): UssdStep {
  return { session: null, reply };
}
