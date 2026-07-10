import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { fetchNetwork } from "@/lib/network";
import { bookTrip, saveTrip } from "@/lib/actions";
import { buildPlanOverlay } from "@/lib/map/plan-overlay";
import { LiveMapLazy } from "@/components/map/LiveMapLazy";
import { HomeSheet } from "@/components/home/HomeSheet";
import { StoryBar } from "@/components/story/StoryBar";
import {
  formatUsd,
  planTrip,
  resolveStopQuery,
  type Network,
  type NetworkStop,
} from "@svika/shared";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveParam(
  network: Network,
  raw: string,
): { stop: NetworkStop | null; suggestions: NetworkStop[] } {
  if (UUID_RE.test(raw)) {
    const stop = network.stops.find((s) => s.id === raw) ?? null;
    return { stop, suggestions: stop ? [] : network.stops };
  }
  const result = resolveStopQuery(network, raw);
  return { stop: result.match, suggestions: result.suggestions };
}

// The plan page. Receives free text or stop ids; free text that resolves
// confidently plans straight away, anything else becomes a stop picker.
// A resolved plan renders on the live map itself: ride legs on the real
// road, walking legs dashed, and the pay actions one thumb away in the
// same bottom sheet grammar as home.
export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const fromRaw = typeof params.from === "string" ? params.from : "";
  const toRaw = typeof params.to === "string" ? params.to : "";
  const err = typeof params.err === "string" ? params.err : "";
  const justSaved = params.saved === "1";
  if (!fromRaw || !toRaw) redirect("/app");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const network = await fetchNetwork(supabase);
  const from = resolveParam(network, fromRaw);
  const to = resolveParam(network, toRaw);

  // both sides resolved: plan
  const plan =
    from.stop && to.stop ? planTrip(network, from.stop.id, to.stop.id) : null;

  const stopName = (id: string) => network.stops.find((s) => s.id === id)?.name ?? id;

  if (!from.stop || !to.stop) {
    return (
      <main className="shell">
        <header className="shell-top">
          <Link href="/app" className="auth-link">
            ← {t(lang, "common.back")}
          </Link>
        </header>
        <section className="svika-card picker-card svika-animate-fade-up">
          <h1 className="svika-headline">
            {!from.stop ? t(lang, "plan.pickFrom") : t(lang, "plan.pickTo")}
          </h1>
          <p className="svika-body empty-note">{t(lang, "plan.noMatch")}</p>
          <ul className="picker-list">
            {(!from.stop ? from.suggestions : to.suggestions).map((s) => {
              const href = !from.stop
                ? `/app/plan?from=${s.id}&to=${encodeURIComponent(toRaw)}`
                : `/app/plan?from=${encodeURIComponent(fromRaw)}&to=${s.id}`;
              return (
                <li key={s.id}>
                  <Link className="picker-item touch-target" href={href}>
                    {s.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="shell">
        <header className="shell-top">
          <Link href="/app" className="auth-link">
            ← {t(lang, "common.back")}
          </Link>
        </header>
        <section className="svika-card picker-card">
          <p className="svika-body">{t(lang, "plan.noRoute")}</p>
        </section>
      </main>
    );
  }

  const overlay = buildPlanOverlay(network, plan);

  return (
    <main className="home-screen">
      <div className="home-map">
        <LiveMapLazy
          labels={{
            ariaLabel: t(lang, "map.ariaLabel"),
            demoChip: t(lang, "map.demoChip"),
            unavailable: t(lang, "map.unavailable"),
          }}
          overlay={overlay ?? undefined}
        />
      </div>

      <StoryBar params={params} lang={lang} />

      <header className="home-chips">
        <Link className="home-chip svika-glass plan-back touch-target" href="/app">
          ← {t(lang, "common.back")}
        </Link>
      </header>

      <HomeSheet
        className="plan-sheet"
        openLabel={t(lang, "plan.sheetOpen")}
        closeLabel={t(lang, "home.sheetClose")}
        defaultOpen={justSaved || err !== ""}
        peek={
          <>
            <div className="plan-sheet-head">
              <h1 className="svika-headline home-sheet-title">
                {t(lang, "plan.title")}
              </h1>
              <p className="svika-meta home-sheet-hint plan-endpoints-line">
                {from.stop.name} → {to.stop.name}
              </p>
            </div>
            <div className="plan-fare-row">
              <p className="plan-total svika-mono-code">
                {formatUsd(plan.totalFareCents)}
              </p>
              <p className="svika-meta plan-fare-meta">
                {t(lang, "plan.about")} {plan.totalMinutes} {t(lang, "common.minutes")}{" "}
                · {plan.boardings} {t(lang, "plan.boardings")}
              </p>
            </div>
            {err === "balance" && (
              <p className="auth-error svika-body">{t(lang, "plan.insufficient")}</p>
            )}
            {err === "noroute" && (
              <p className="auth-error svika-body">{t(lang, "plan.noRoute")}</p>
            )}
            <form action={bookTrip} className="plan-pay">
              <input type="hidden" name="from" value={from.stop.id} />
              <input type="hidden" name="to" value={to.stop.id} />
              <button
                className="auth-submit touch-target"
                type="submit"
                name="payment"
                value="wallet"
              >
                {t(lang, "plan.payWallet")}
              </button>
              <button
                className="pay-cash touch-target"
                type="submit"
                name="payment"
                value="cash"
              >
                {t(lang, "plan.reserveCash")}
              </button>
            </form>
          </>
        }
      >
        <ol className="plan-legs">
          {plan.legs.map((leg, i) =>
            leg.type === "ride" ? (
              <li key={i} className="plan-leg">
                <span className="plan-leg-kind plan-leg-ride svika-meta">
                  {t(lang, "plan.ride")}
                </span>
                <span className="plan-leg-body">
                  <span className="svika-body">{leg.routeName}</span>
                  <span className="svika-meta">
                    {t(lang, "plan.alightAt")} {stopName(leg.alightStopId)} ·{" "}
                    {leg.rideMinutes} {t(lang, "common.minutes")} ·{" "}
                    <span className="svika-mono-code plan-leg-fare">
                      {formatUsd(leg.fareCents)}
                    </span>
                  </span>
                </span>
              </li>
            ) : (
              <li key={i} className="plan-leg">
                <span className="plan-leg-kind plan-leg-walk svika-meta">
                  {t(lang, "plan.walk")}
                </span>
                <span className="plan-leg-body">
                  <span className="svika-body">{stopName(leg.toStopId)}</span>
                  <span className="svika-meta">
                    {leg.walkMinutes} {t(lang, "common.minutes")} · {leg.walkMeters} m
                  </span>
                </span>
              </li>
            ),
          )}
        </ol>

        {justSaved ? (
          <p className="svika-body plan-saved" data-testid="trip-saved">
            {t(lang, "plan.savedNote")}
          </p>
        ) : (
          <form action={saveTrip} className="plan-save">
            <input type="hidden" name="from" value={from.stop.id} />
            <input type="hidden" name="to" value={to.stop.id} />
            <label className="svika-meta" htmlFor="nickname">
              {t(lang, "plan.saveTitle")}
            </label>
            <div className="plan-save-row">
              <input
                id="nickname"
                name="nickname"
                className="auth-input"
                placeholder={t(lang, "plan.savePlaceholder")}
                maxLength={40}
                autoComplete="off"
                required
              />
              <button className="plan-save-cta touch-target" type="submit">
                {t(lang, "plan.saveCta")}
              </button>
            </div>
            {(err === "nickname" || err === "save") && (
              <p className="auth-error svika-body">{t(lang, "plan.saveErr")}</p>
            )}
          </form>
        )}
      </HomeSheet>
    </main>
  );
}
