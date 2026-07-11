import { describe, expect, test, vi } from "vitest";
import {
  USSD_CODE,
  startUssd,
  ussdInput,
  type UssdEffects,
  type UssdSession,
} from "../src/lib/ussd/machine";

// The Gogo vision scene's engine: a real menu state machine awaiting a telco
// aggregator agreement. Effects are injected behind an adapter so the scene
// can wire the mock money twin and the real eta endpoint without the machine
// knowing which is which.

function effects(overrides: Partial<UssdEffects> = {}): UssdEffects {
  return {
    balanceCents: vi.fn().mockResolvedValue(250),
    bookUsualTrip: vi.fn().mockResolvedValue({
      routeName: "Mbare to Copacabana",
      code: "7421",
      fareCents: 150,
    }),
    kombiEta: vi.fn().mockResolvedValue({ minutes: 6, isMock: false }),
    claimChange: vi.fn().mockResolvedValue({ ok: true, balanceCents: 300 }),
    ...overrides,
  };
}

function menuSession(): UssdSession {
  const step = startUssd();
  if (!step.session) throw new Error("start must open a session");
  return step.session;
}

describe("USSD machine: dialling in", () => {
  test("exposes the short code the phone dials", () => {
    expect(USSD_CODE).toBe("*123#");
  });

  test("start opens a live session on the main menu", () => {
    const step = startUssd();
    expect(step.reply).toEqual({ kind: "con", id: "menu" });
    expect(step.session).toEqual({ screen: "menu" });
  });
});

describe("USSD machine: main menu", () => {
  test("1 reads the balance through the effect and ends the session", async () => {
    const fx = effects();
    const step = await ussdInput(menuSession(), "1", fx);
    expect(step.reply).toEqual({ kind: "end", id: "balance", balanceCents: 250 });
    expect(step.session).toBeNull();
    expect(fx.balanceCents).toHaveBeenCalledOnce();
  });

  test("2 books the usual trip and hands back the board code", async () => {
    const fx = effects();
    const step = await ussdInput(menuSession(), "2", fx);
    expect(step.reply).toEqual({
      kind: "end",
      id: "booked",
      routeName: "Mbare to Copacabana",
      code: "7421",
      fareCents: 150,
    });
    expect(step.session).toBeNull();
    expect(fx.bookUsualTrip).toHaveBeenCalledOnce();
  });

  test("3 asks how far the kombi is and keeps the estimate's basis flag", async () => {
    const fx = effects({
      kombiEta: vi.fn().mockResolvedValue({ minutes: 4, isMock: true }),
    });
    const step = await ussdInput(menuSession(), "3", fx);
    expect(step.reply).toEqual({ kind: "end", id: "eta", minutes: 4, isMock: true });
    expect(step.session).toBeNull();
  });

  test("4 moves to the claim code prompt without touching any effect", async () => {
    const fx = effects();
    const step = await ussdInput(menuSession(), "4", fx);
    expect(step.reply).toEqual({ kind: "con", id: "claim-code" });
    expect(step.session).toEqual({ screen: "claim-code" });
    expect(fx.balanceCents).not.toHaveBeenCalled();
    expect(fx.bookUsualTrip).not.toHaveBeenCalled();
    expect(fx.kombiEta).not.toHaveBeenCalled();
    expect(fx.claimChange).not.toHaveBeenCalled();
  });

  test("an unknown choice re-renders the menu with the error line and calls nothing", async () => {
    const fx = effects();
    for (const junk of ["9", "0", "", "x", "12"]) {
      const step = await ussdInput(menuSession(), junk, fx);
      expect(step.reply).toEqual({ kind: "con", id: "menu", error: "invalid" });
      expect(step.session).toEqual({ screen: "menu" });
    }
    expect(fx.balanceCents).not.toHaveBeenCalled();
    expect(fx.bookUsualTrip).not.toHaveBeenCalled();
    expect(fx.kombiEta).not.toHaveBeenCalled();
    expect(fx.claimChange).not.toHaveBeenCalled();
  });
});

describe("USSD machine: claiming change as credit", () => {
  async function atClaimPrompt(fx: UssdEffects): Promise<UssdSession> {
    const step = await ussdInput(menuSession(), "4", fx);
    if (!step.session) throw new Error("claim prompt must keep the session");
    return step.session;
  }

  test("a four digit code claims through the effect and reports the new balance", async () => {
    const fx = effects();
    const step = await ussdInput(await atClaimPrompt(fx), "8305", fx);
    expect(step.reply).toEqual({ kind: "end", id: "claimed", balanceCents: 300 });
    expect(step.session).toBeNull();
    expect(fx.claimChange).toHaveBeenCalledOnce();
    expect(fx.claimChange).toHaveBeenCalledWith("8305");
  });

  test("a rejected code ends the session with the rejection screen", async () => {
    const fx = effects({
      claimChange: vi.fn().mockResolvedValue({ ok: false }),
    });
    const step = await ussdInput(await atClaimPrompt(fx), "8305", fx);
    expect(step.reply).toEqual({ kind: "end", id: "claim-rejected" });
    expect(step.session).toBeNull();
  });

  test("0 cancels back to the main menu without calling the claim effect", async () => {
    const fx = effects();
    const step = await ussdInput(await atClaimPrompt(fx), "0", fx);
    expect(step.reply).toEqual({ kind: "con", id: "menu" });
    expect(step.session).toEqual({ screen: "menu" });
    expect(fx.claimChange).not.toHaveBeenCalled();
  });

  test("anything that is not four digits re-prompts and never reaches the effect", async () => {
    const fx = effects();
    for (const junk of ["12", "12345", "abcd", "", "83 5"]) {
      const step = await ussdInput(await atClaimPrompt(fx), junk, fx);
      expect(step.reply).toEqual({ kind: "con", id: "claim-code", error: "invalid" });
      expect(step.session).toEqual({ screen: "claim-code" });
    }
    expect(fx.claimChange).not.toHaveBeenCalled();
  });
});

describe("USSD machine: failure and discipline", () => {
  test("a throwing effect ends the session on the unavailable screen", async () => {
    const fx = effects({
      bookUsualTrip: vi.fn().mockRejectedValue(new Error("spine down")),
    });
    const step = await ussdInput(menuSession(), "2", fx);
    expect(step.reply).toEqual({ kind: "end", id: "unavailable" });
    expect(step.session).toBeNull();
  });

  test("input never mutates the session it was given", async () => {
    const fx = effects();
    const session = menuSession();
    const frozen = Object.freeze({ ...session });
    await ussdInput(session, "4", fx);
    expect(session).toEqual(frozen);
  });
});
