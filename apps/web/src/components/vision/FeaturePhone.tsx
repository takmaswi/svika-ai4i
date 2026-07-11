"use client";

// Gogo's mbudzi: a rendered old feature phone whose keypad the judge really
// types on. Behind the screen sits the tested USSD machine (lib/ussd); the
// money effects are fixture twins that touch nothing, and the "how far"
// answer comes through the injected server action from the real eta wiring.
import { useState } from "react";
import {
  startUssd,
  ussdInput,
  USSD_CODE,
  type UssdEffects,
  type UssdReply,
  type UssdSession,
} from "@/lib/ussd/machine";

export interface FeaturePhoneLabels {
  menu: string[];
  invalid: string;
  claimPrompt: string;
  balance: string;
  booked: string;
  bookedCode: string;
  eta: string;
  etaDemo: string;
  claimed: string;
  claimRejected: string;
  unavailable: string;
  idleHint: string;
  endedHint: string;
  waiting: string;
  keyOk: string;
  keyClear: string;
}

interface FeaturePhoneProps {
  labels: FeaturePhoneLabels;
  etaAction: () => Promise<{ minutes: number; isMock: boolean }>;
}

// Fixture values for the money menus: Gogo's staged credit and her staged
// booking. Nothing here reads or writes any account.
const FIXTURE_BALANCE_CENTS = 250;
const FIXTURE_CHANGE_CENTS = 50;
const FIXTURE_BOOKING = {
  routeName: "Heights 4B",
  code: "7421",
  fareCents: 150,
};

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const spacedCode = (code: string) => `${code.slice(0, 2)} ${code.slice(2)}`;

function replyLines(reply: UssdReply, labels: FeaturePhoneLabels): string[] {
  switch (reply.id) {
    case "menu":
      return [
        ...(reply.error ? [labels.invalid] : []),
        "Svika",
        ...labels.menu,
      ];
    case "claim-code":
      return [...(reply.error ? [labels.invalid] : []), labels.claimPrompt];
    case "balance":
      return [`${labels.balance} ${dollars(reply.balanceCents)}`];
    case "booked":
      return [
        `${labels.booked} ${reply.routeName} ${dollars(reply.fareCents)}`,
        `${labels.bookedCode} ${spacedCode(reply.code)}`,
      ];
    case "eta":
      return [
        `${labels.eta} ${reply.minutes} min`,
        ...(reply.isMock ? [labels.etaDemo] : []),
      ];
    case "claimed":
      return [`${labels.claimed} ${dollars(reply.balanceCents)}`];
    case "claim-rejected":
      return [labels.claimRejected];
    case "unavailable":
      return [labels.unavailable];
  }
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

export function FeaturePhone({ labels, etaAction }: FeaturePhoneProps) {
  const [session, setSession] = useState<UssdSession | null>(null);
  const [lines, setLines] = useState<string[] | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const effects: UssdEffects = {
    balanceCents: async () => FIXTURE_BALANCE_CENTS,
    bookUsualTrip: async () => FIXTURE_BOOKING,
    kombiEta: etaAction,
    claimChange: async () => ({
      ok: true,
      balanceCents: FIXTURE_BALANCE_CENTS + FIXTURE_CHANGE_CENTS,
    }),
  };

  const press = (key: string) => {
    if (busy) return;
    setTyped((v) => (v.length >= 12 ? v : v + key));
  };

  const clear = () => {
    if (busy) return;
    setTyped((v) => v.slice(0, -1));
  };

  const ok = async () => {
    if (busy) return;
    // outside a session the buffer is a dialled number: the short code opens
    if (!session) {
      if (typed !== USSD_CODE) {
        setTyped("");
        return;
      }
      const step = startUssd();
      setSession(step.session);
      setLines(replyLines(step.reply, labels));
      setTyped("");
      return;
    }
    const input = typed;
    setTyped("");
    setBusy(true);
    try {
      const step = await ussdInput(session, input, effects);
      setSession(step.session);
      setLines(replyLines(step.reply, labels));
    } finally {
      setBusy(false);
    }
  };

  const hint = session ? null : lines ? labels.endedHint : labels.idleHint;

  return (
    <div className="mbudzi" data-testid="feature-phone">
      <div className="mbudzi-screen" data-testid="phone-screen" aria-live="polite">
        {busy ? (
          <p className="mbudzi-line">{labels.waiting}</p>
        ) : (
          <>
            {(lines ?? []).map((line, i) => (
              <p key={`${i}-${line}`} className="mbudzi-line">
                {line}
              </p>
            ))}
            {hint && <p className="mbudzi-line mbudzi-hint">{hint}</p>}
          </>
        )}
        <p className="mbudzi-typed">{typed || " "}</p>
      </div>
      <div className="mbudzi-keys">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className="mbudzi-key touch-target"
            data-testid={`phone-key-${key === "*" ? "star" : key === "#" ? "hash" : key}`}
            onClick={() => press(key)}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="mbudzi-actions">
        <button
          type="button"
          className="mbudzi-key mbudzi-clear touch-target"
          data-testid="phone-clear"
          onClick={clear}
        >
          {labels.keyClear}
        </button>
        <button
          type="button"
          className="mbudzi-key mbudzi-ok touch-target"
          data-testid="phone-ok"
          onClick={ok}
        >
          {labels.keyOk}
        </button>
      </div>
    </div>
  );
}
