// The hwindi surface: sign in → pick route and direction → keypad → verdict.
// Fat finger first: one action per screen, huge targets, high contrast for
// sunlight, works one handed in a moving kombi. Online redemption only in P1;
// the offline queue (P2) will wrap the same redeem call.
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { formatUsd } from "@svika/shared";
import { supabase } from "./lib/supabase";
import { t, type Lang } from "./lib/dict";
import { appendDigit, eraseDigit, isComplete } from "./lib/keypad";

type Direction = "outbound" | "inbound";

interface RouteInfo {
  id: string;
  code: string;
  name: string;
  firstStop: string;
  lastStop: string;
}

type Outcome =
  | "success"
  | "already_redeemed"
  | "invalid_code"
  | "rate_limited"
  | "not_ready";

interface RedeemedTicket {
  ticketId: string;
  fareCents: number;
  paymentMethod: "wallet" | "cash";
  /** what the code advanced the ticket to: redeemed | loaded | collected */
  stage: string;
}

/** Real USD notes a rider hands over on a kombi. */
const NOTE_OPTIONS_CENTS = [100, 200, 500, 1000, 2000];

interface RouteStopRow {
  route_id: string;
  seq: number;
  stops: { name: string } | { name: string }[] | null;
}

function stopName(embed: RouteStopRow["stops"]): string {
  if (!embed) return "";
  return Array.isArray(embed) ? (embed[0]?.name ?? "") : embed.name;
}

export default function App() {
  const [lang, setLang] = useState<Lang>("sn");
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [direction, setDirection] = useState<Direction>("outbound");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [redeemed, setRedeemed] = useState<RedeemedTicket | null>(null);
  const [changeMode, setChangeMode] = useState(false);
  const [changeCents, setChangeCents] = useState<number | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [faresCovered, setFaresCovered] = useState(1);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    void (async () => {
      const [routesRes, stopsRes] = await Promise.all([
        supabase
          .from("routes")
          .select("id, code, name")
          .eq("active", true)
          .neq("code", "TEST-01")
          .order("code"),
        supabase
          .from("route_stops")
          .select("route_id, seq, stops(name)")
          .eq("direction", "outbound")
          .order("seq"),
      ]);
      const stopRows = (stopsRes.data ?? []) as unknown as RouteStopRow[];
      const list = (routesRes.data ?? []).map((r) => {
        const mine = stopRows.filter((s) => s.route_id === r.id);
        return {
          id: r.id as string,
          code: r.code as string,
          name: r.name as string,
          firstStop: stopName(mine[0]?.stops ?? null),
          lastStop: stopName(mine[mine.length - 1]?.stops ?? null),
        };
      });
      setRoutes(list.filter((r) => r.firstStop && r.lastStop));
    })();
  }, [session]);

  const langToggle = (
    <div className="lang-toggle" role="group" aria-label="language">
      {(["sn", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          className={lang === l ? "lang-on" : ""}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );

  if (!ready) return <main className="hwindi-shell" />;

  if (!session) {
    return <SignIn lang={lang} langToggle={langToggle} />;
  }

  const resetForNext = () => {
    setCode("");
    setOutcome(null);
    setRedeemed(null);
    setChangeMode(false);
    setChangeCents(null);
    setChangeError(null);
    setFaresCovered(1);
  };

  if (outcome) {
    const isCash = redeemed?.paymentMethod === "cash";

    // change credited: confirmation the rider can see over the hwindi's shoulder
    if (changeCents !== null) {
      return (
        <main
          className="hwindi-shell hwindi-verdict hwindi-verdict-success"
          data-testid="change-done"
        >
          <p className="hwindi-verdict-word">{t(lang, "change.done")}</p>
          <p className="hwindi-verdict-code svika-mono-code">
            {formatUsd(changeCents)}
          </p>
          <button
            className="hwindi-cta touch-target"
            type="button"
            onClick={resetForNext}
          >
            {t(lang, "result.next")}
          </button>
        </main>
      );
    }

    // note picker: which note, covering how many fares (splitting one note
    // across companions is normal practice; the remainder is the change)
    if (changeMode && redeemed) {
      const covered = redeemed.fareCents * faresCovered;
      const creditChange = async (noteCents: number) => {
        if (busy) return;
        setBusy(true);
        setChangeError(null);
        const { data, error } = await supabase.rpc("record_change_credit", {
          p_ticket: redeemed.ticketId,
          p_note_cents: noteCents,
          p_covered_fares: faresCovered,
        });
        setBusy(false);
        if (error) {
          setChangeError(
            error.message.includes("no change")
              ? t(lang, "change.none")
              : t(lang, "change.error"),
          );
          return;
        }
        const row = (data as { change_cents: number }[] | null)?.[0];
        setChangeCents(row?.change_cents ?? 0);
      };
      return (
        <main className="hwindi-shell" data-testid="change-picker">
          <header className="hwindi-header">
            <button className="hwindi-quiet" type="button" onClick={resetForNext}>
              ← {t(lang, "result.next")}
            </button>
            <h1 className="svika-headline">{t(lang, "change.title")}</h1>
          </header>

          <div className="hwindi-covered">
            <span className="svika-meta">{t(lang, "change.faresCovered")}</span>
            <div className="hwindi-covered-row">
              <button
                type="button"
                className="hwindi-key touch-target"
                aria-label="-"
                disabled={faresCovered <= 1}
                onClick={() => setFaresCovered((n) => Math.max(1, n - 1))}
              >
                −
              </button>
              <output className="hwindi-covered-count" data-testid="fares-covered">
                {faresCovered}
              </output>
              <button
                type="button"
                className="hwindi-key touch-target"
                aria-label="+"
                disabled={faresCovered >= 8}
                onClick={() => setFaresCovered((n) => Math.min(8, n + 1))}
              >
                +
              </button>
            </div>
            <p className="svika-meta hwindi-route-tag">
              {faresCovered} × {formatUsd(redeemed.fareCents)} = {formatUsd(covered)}
            </p>
          </div>

          <div className="hwindi-notes">
            {NOTE_OPTIONS_CENTS.map((note) => (
              <button
                key={note}
                type="button"
                className="hwindi-note-btn touch-target"
                disabled={busy || note <= covered}
                onClick={() => void creditChange(note)}
              >
                {formatUsd(note)}
              </button>
            ))}
          </div>
          {changeError && <p className="hwindi-error svika-body">{changeError}</p>}
        </main>
      );
    }

    return (
      <main
        className={`hwindi-shell hwindi-verdict hwindi-verdict-${outcome}`}
        data-testid="verdict"
      >
        <p className="hwindi-verdict-word">
          {outcome === "success" && redeemed && redeemed.stage !== "redeemed"
            ? t(lang, `result.${redeemed.stage}` as "result.loaded")
            : t(lang, `result.${outcome}`)}
        </p>
        {outcome === "success" && redeemed && (
          <>
            <p className="hwindi-verdict-code svika-mono-code">
              {formatUsd(redeemed.fareCents)}
            </p>
            <p className="hwindi-verdict-sub">
              {isCash
                ? redeemed.stage === "collected"
                  ? ""
                  : t(lang, "result.collectCash")
                : t(lang, "result.walletPaid")}
            </p>
          </>
        )}
        {outcome === "success" && isCash && redeemed?.stage !== "collected" && (
          <button
            className="hwindi-secondary touch-target"
            type="button"
            data-testid="change-offer"
            onClick={() => setChangeMode(true)}
          >
            {t(lang, "change.offer")}
          </button>
        )}
        <button
          className="hwindi-cta touch-target"
          type="button"
          onClick={resetForNext}
        >
          {outcome === "success" ? t(lang, "result.next") : t(lang, "result.retry")}
        </button>
      </main>
    );
  }

  if (!route) {
    return (
      <main className="hwindi-shell">
        <header className="hwindi-header">
          <div className="hwindi-topline">
            <span className="svika-meta">{t(lang, "app.brand")}</span>
            {langToggle}
          </div>
          <h1 className="svika-headline">{t(lang, "route.title")}</h1>
        </header>
        <div className="hwindi-routes">
          {routes.map((r) =>
            (["outbound", "inbound"] as const).map((dir) => (
              <button
                key={`${r.id}-${dir}`}
                type="button"
                className="hwindi-route touch-target"
                onClick={() => {
                  setRoute(r);
                  setDirection(dir);
                }}
              >
                <span className="svika-meta">{r.code}</span>
                <span className="hwindi-route-name">
                  {t(lang, "route.towards")}{" "}
                  {dir === "outbound" ? r.lastStop : r.firstStop}
                </span>
              </button>
            )),
          )}
        </div>
        <button
          className="hwindi-quiet"
          type="button"
          onClick={() => void supabase.auth.signOut()}
        >
          {t(lang, "keypad.signOut")}
        </button>
      </main>
    );
  }

  const submit = async () => {
    if (!isComplete(code) || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("redeem_board_code", {
      p_route: route.id,
      p_direction: direction,
      p_code: code,
    });
    setBusy(false);
    if (error) {
      setOutcome("invalid_code");
      return;
    }
    const row = (
      data as
        | {
            outcome: Outcome;
            ticket_id: string | null;
            fare_cents: number | null;
            payment_method: "wallet" | "cash" | null;
            stage?: string | null;
          }[]
        | null
    )?.[0];
    if (row?.outcome === "success" && row.ticket_id && row.fare_cents !== null) {
      setRedeemed({
        ticketId: row.ticket_id,
        fareCents: row.fare_cents,
        paymentMethod: row.payment_method ?? "wallet",
        stage: row.stage ?? "redeemed",
      });
    }
    setOutcome(row?.outcome ?? "invalid_code");
  };

  return (
    <main className="hwindi-shell">
      <header className="hwindi-header">
        <div className="hwindi-topline">
          <button
            className="hwindi-quiet"
            type="button"
            onClick={() => {
              setRoute(null);
              setCode("");
            }}
          >
            ← {t(lang, "keypad.changeRoute")}
          </button>
          {langToggle}
        </div>
        <p className="svika-meta hwindi-route-tag">
          {route.code} · {t(lang, "route.towards")}{" "}
          {direction === "outbound" ? route.lastStop : route.firstStop}
        </p>
        <h1 className="svika-headline">{t(lang, "keypad.title")}</h1>
      </header>

      <output className="hwindi-code" data-testid="code-display" aria-live="polite">
        {code.padEnd(4, "·")}
      </output>

      <div className="hwindi-keys">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            className="hwindi-key touch-target"
            onClick={() => setCode((c) => appendDigit(c, d))}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className="hwindi-key hwindi-key-quiet touch-target"
          aria-label={t(lang, "keypad.erase")}
          onClick={() => setCode((c) => eraseDigit(c))}
        >
          ⌫
        </button>
        <button
          type="button"
          className="hwindi-key touch-target"
          onClick={() => setCode((c) => appendDigit(c, "0"))}
        >
          0
        </button>
        <span aria-hidden className="hwindi-key-spacer" />
      </div>

      <button
        className="hwindi-cta touch-target"
        type="button"
        disabled={!isComplete(code) || busy}
        onClick={() => void submit()}
      >
        {busy ? t(lang, "keypad.busy") : t(lang, "keypad.clear")}
      </button>
    </main>
  );
}

function SignIn({
  lang,
  langToggle,
}: {
  lang: Lang;
  langToggle: React.ReactNode;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const canSubmit = useMemo(
    () => email.includes("@") && password.length >= 6,
    [email, password],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(false);
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (err) setError(true);
  };

  return (
    <main className="hwindi-shell">
      <header className="hwindi-header">
        <div className="hwindi-topline">
          <span className="svika-meta">SVIKA · HWINDI</span>
          {langToggle}
        </div>
        <h1 className="svika-headline">{t(lang, "signin.title")}</h1>
        <p className="svika-meta hwindi-note-left">{t(lang, "signin.note")}</p>
      </header>
      <form className="hwindi-form" onSubmit={(e) => void submit(e)}>
        <label className="svika-meta" htmlFor="email">
          {t(lang, "signin.email")}
        </label>
        <input
          id="email"
          type="email"
          className="hwindi-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
        <label className="svika-meta" htmlFor="password">
          {t(lang, "signin.password")}
        </label>
        <input
          id="password"
          type="password"
          className="hwindi-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <p className="hwindi-error svika-body">{t(lang, "signin.error")}</p>}
        <button
          className="hwindi-cta touch-target"
          type="submit"
          disabled={!canSubmit || busy}
        >
          {busy ? t(lang, "signin.busy") : t(lang, "signin.cta")}
        </button>
      </form>
    </main>
  );
}
