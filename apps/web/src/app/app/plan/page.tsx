import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { fetchNetwork } from "@/lib/network";
import { bookTrip } from "@/lib/actions";
import {
  formatUsd,
  planTrip,
  resolveStopQuery,
  type Network,
  type NetworkStop,
} from "@svika/shared";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
// A judge can type whatever they like here and always lands on a plan.
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

  const stopName = (id: string) =>
    network.stops.find((s) => s.id === id)?.name ?? id;

  return (
    <main className="shell">
      <header className="shell-top">
        <Link href="/app" className="auth-link">
          ← {t(lang, "common.back")}
        </Link>
      </header>

      {(!from.stop || !to.stop) && (
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
      )}

      {from.stop && to.stop && !plan && (
        <section className="svika-card picker-card">
          <p className="svika-body">{t(lang, "plan.noRoute")}</p>
        </section>
      )}

      {from.stop && to.stop && plan && (
        <section className="plan-card svika-card svika-animate-fade-up">
          <h1 className="svika-headline">{t(lang, "plan.title")}</h1>
          <p className="svika-body plan-endpoints">
            {from.stop.name} → {to.stop.name}
          </p>

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
                    <span className="svika-body">
                      {stopName(leg.toStopId)}
                    </span>
                    <span className="svika-meta">
                      {leg.walkMinutes} {t(lang, "common.minutes")} ·{" "}
                      {leg.walkMeters} m
                    </span>
                  </span>
                </li>
              ),
            )}
          </ol>

          <div className="plan-summary">
            <p className="svika-meta">{t(lang, "plan.totalFare")}</p>
            <p className="plan-total svika-mono-code">
              {formatUsd(plan.totalFareCents)}
            </p>
            <p className="svika-meta">
              {t(lang, "plan.about")} {plan.totalMinutes}{" "}
              {t(lang, "common.minutes")} · {plan.boardings}{" "}
              {t(lang, "plan.boardings")}
            </p>
          </div>

          {err === "balance" && (
            <p className="auth-error svika-body">
              {t(lang, "plan.insufficient")}
            </p>
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
        </section>
      )}
    </main>
  );
}
