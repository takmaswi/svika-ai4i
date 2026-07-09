import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/roles";
import { formatUsd } from "@svika/shared";

interface RevenueRow {
  day: string;
  route_code: string;
  route_name: string;
  tickets: number;
  gross_cents: number;
  commission_cents: number;
  net_cents: number;
}

interface WatchdogFlagRow {
  day: string;
  flagged: boolean;
  explanation_en: string | null;
  explanation_sn: string | null;
}

const WATCHDOG_FLAGS_SHOWN = 3;

// The owner ledger view: settled digital fares aggregated per day and route,
// every number derived from the double entry ledger at read time. Audit
// language talks about patterns and totals, never about a named person.
export default async function OwnerPage() {
  const lang = await getLang();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await resolveRole(supabase, user.id);
  if (role !== "owner") redirect("/app");

  const [summaryRes, balanceRes, watchdogRes] = await Promise.all([
    supabase.rpc("owner_revenue_summary"),
    supabase
      .from("account_balances")
      .select("balance_cents")
      .eq("kind", "owner_wallet")
      .maybeSingle(),
    supabase
      .from("watchdog_day_flags")
      .select("day, flagged, explanation_en, explanation_sn")
      .order("day", { ascending: false }),
  ]);

  const rows = (summaryRes.data ?? []) as RevenueRow[];
  const balance = balanceRes.data?.balance_cents ?? 0;
  const totalNet = rows.reduce((sum, r) => sum + r.net_cents, 0);

  const watchdogDays = (watchdogRes.data ?? []) as WatchdogFlagRow[];
  const flaggedDays = watchdogDays.filter((d) => d.flagged);
  const watchdogSummary = t(lang, "owner.watchdogSummary")
    .replace("{count}", String(watchdogDays.length))
    .replace("{flagged}", String(flaggedDays.length));

  return (
    <main className="shell">
      <header className="shell-top">
        <Link href="/app" className="auth-link">
          ← {t(lang, "common.back")}
        </Link>
      </header>

      <section className="wallet-strip svika-card svika-animate-fade-up">
        <div>
          <p className="svika-meta">{t(lang, "owner.balance")}</p>
          <p className="wallet-amount svika-mono-code" data-testid="owner-balance">
            {formatUsd(balance)}
          </p>
        </div>
        <div>
          <p className="svika-meta">{t(lang, "owner.title")}</p>
          <p className="wallet-amount svika-mono-code">{formatUsd(totalNet)}</p>
        </div>
      </section>

      <section className="svika-card wallet-panel">
        <h1 className="svika-headline">{t(lang, "owner.title")}</h1>
        {rows.length === 0 ? (
          <p className="svika-body empty-note">{t(lang, "owner.none")}</p>
        ) : (
          <div className="owner-table-wrap">
            <table className="owner-table" data-testid="owner-revenue">
              <thead>
                <tr>
                  <th className="svika-meta">{t(lang, "owner.day")}</th>
                  <th className="svika-meta">{t(lang, "owner.route")}</th>
                  <th className="svika-meta">{t(lang, "owner.tickets")}</th>
                  <th className="svika-meta">{t(lang, "owner.gross")}</th>
                  <th className="svika-meta">{t(lang, "owner.commission")}</th>
                  <th className="svika-meta">{t(lang, "owner.net")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="svika-mono-code">{r.day}</td>
                    <td className="svika-body">{r.route_code}</td>
                    <td className="svika-mono-code">{r.tickets}</td>
                    <td className="svika-mono-code">{formatUsd(r.gross_cents)}</td>
                    <td className="svika-mono-code">{formatUsd(r.commission_cents)}</td>
                    <td className="svika-mono-code">{formatUsd(r.net_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="svika-meta empty-note">{t(lang, "owner.note")}</p>
      </section>

      <section className="svika-card wallet-panel" data-testid="owner-watchdog">
        <div className="watchdog-head">
          <h2 className="svika-headline">{t(lang, "owner.watchdog")}</h2>
          <span className="svika-meta watchdog-label">
            {t(lang, "owner.watchdogSimulated")}
          </span>
        </div>
        {watchdogDays.length === 0 ? (
          <p className="svika-body empty-note">{t(lang, "owner.watchdogEmpty")}</p>
        ) : (
          <>
            <p className="svika-meta">{watchdogSummary}</p>
            {flaggedDays.length === 0 ? (
              <p className="svika-body empty-note">{t(lang, "owner.watchdogNone")}</p>
            ) : (
              <div className="watchdog-flags">
                {flaggedDays.slice(0, WATCHDOG_FLAGS_SHOWN).map((d) => (
                  <div key={d.day} className="watchdog-flag">
                    <p className="svika-mono-code watchdog-day">{d.day}</p>
                    <p className="svika-body">
                      {(lang === "sn" ? d.explanation_sn : d.explanation_en) ??
                        d.explanation_en}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <p className="svika-meta empty-note">{t(lang, "owner.watchdogNote")}</p>
      </section>
    </main>
  );
}
