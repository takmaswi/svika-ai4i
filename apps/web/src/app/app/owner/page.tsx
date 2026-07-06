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

  const [summaryRes, balanceRes] = await Promise.all([
    supabase.rpc("owner_revenue_summary"),
    supabase
      .from("account_balances")
      .select("balance_cents")
      .eq("kind", "owner_wallet")
      .maybeSingle(),
  ]);

  const rows = (summaryRes.data ?? []) as RevenueRow[];
  const balance = balanceRes.data?.balance_cents ?? 0;
  const totalNet = rows.reduce((sum, r) => sum + r.net_cents, 0);

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
    </main>
  );
}
