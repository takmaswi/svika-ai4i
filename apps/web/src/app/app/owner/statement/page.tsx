import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/roles";
import { formatUsd } from "@svika/shared";
import { BackIcon } from "@/components/icons";
import { PrintButton } from "@/components/owner/PrintButton";

interface RevenueRow {
  day: string;
  route_code: string;
  route_name: string;
  tickets: number;
  gross_cents: number;
  commission_cents: number;
  net_cents: number;
}

// The printable statement: the owner's settled digital fares, day by day and
// route by route, straight from the ledger. The print stylesheet strips the
// app chrome and prints black on white; the screen keeps Brand v2.
export default async function StatementPage() {
  const lang = await getLang();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await resolveRole(supabase, user.id);
  if (role !== "owner") redirect("/app");

  const [summaryRes, profileRes] = await Promise.all([
    supabase.rpc("owner_revenue_summary"),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  const rows = (summaryRes.data ?? []) as RevenueRow[];
  const sorted = [...rows].sort(
    (a, b) => a.day.localeCompare(b.day) || a.route_code.localeCompare(b.route_code),
  );
  const totals = rows.reduce(
    (acc, r) => ({
      tickets: acc.tickets + r.tickets,
      gross: acc.gross + r.gross_cents,
      commission: acc.commission + r.commission_cents,
      net: acc.net + r.net_cents,
    }),
    { tickets: 0, gross: 0, commission: 0, net: 0 },
  );

  const locale = lang === "sn" ? "sn-ZW" : "en-ZW";
  const generated = new Date().toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const period =
    sorted.length > 0
      ? `${sorted[0]!.day} ${t(lang, "common.to")} ${sorted[sorted.length - 1]!.day}`
      : generated;

  return (
    <main className="shell statement">
      <header className="screen-head no-print">
        <Link href="/app/owner" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
      </header>

      <section className="svika-card statement-sheet">
        <header className="statement-head">
          <img className="wordmark statement-mark" src="/wordmark.svg" alt="Svika" height={24} />
          <h1 className="svika-headline">{t(lang, "statement.title")}</h1>
        </header>

        <dl className="statement-facts">
          <div>
            <dt className="svika-meta">{t(lang, "statement.owner")}</dt>
            <dd className="svika-body">
              {profileRes.data?.full_name ?? t(lang, "yourdata.none")}
            </dd>
          </div>
          <div>
            <dt className="svika-meta">{t(lang, "statement.period")}</dt>
            <dd className="svika-mono-code">{period}</dd>
          </div>
          <div>
            <dt className="svika-meta">{t(lang, "statement.generated")}</dt>
            <dd className="svika-body">{generated}</dd>
          </div>
        </dl>

        {sorted.length === 0 ? (
          <p className="svika-body empty-note">{t(lang, "owner.none")}</p>
        ) : (
          <div className="owner-table-wrap">
            <table className="owner-table" data-testid="statement-table">
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
                {sorted.map((r, i) => (
                  <tr key={i}>
                    <td className="svika-mono-code">{r.day}</td>
                    <td className="svika-body">{r.route_code}</td>
                    <td className="svika-mono-code">{r.tickets}</td>
                    <td className="svika-mono-code">{formatUsd(r.gross_cents)}</td>
                    <td className="svika-mono-code">{formatUsd(r.commission_cents)}</td>
                    <td className="svika-mono-code">{formatUsd(r.net_cents)}</td>
                  </tr>
                ))}
                <tr className="statement-totals">
                  <td className="svika-meta" colSpan={2}>
                    {t(lang, "statement.totals")}
                  </td>
                  <td className="svika-mono-code">{totals.tickets}</td>
                  <td className="svika-mono-code">{formatUsd(totals.gross)}</td>
                  <td className="svika-mono-code">{formatUsd(totals.commission)}</td>
                  <td className="svika-mono-code">{formatUsd(totals.net)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="svika-meta statement-note">{t(lang, "statement.note")}</p>
      </section>

      <PrintButton label={t(lang, "statement.print")} />
    </main>
  );
}
