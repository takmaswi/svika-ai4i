import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t, type DictKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { fetchNetwork } from "@/lib/network";
import { bookParcel } from "@/lib/actions";
import { formatUsd } from "@svika/shared";
import { BackIcon } from "@/components/icons";
import { boardCodesOf } from "@/lib/tickets";

interface ParcelRow {
  id: string;
  fare_cents: number;
  payment_method: "wallet" | "cash";
  purchased_at: string;
  from_stop: { name: string } | null;
  to_stop: { name: string } | null;
  board_codes:
    | { code: string; valid_until: string; purpose?: string }[]
    | { code: string; valid_until: string; purpose?: string }
    | null;
}

// Parcels: a ticket kind with two codes. LOAD travels with the parcel,
// COLLECT goes to the receiver. Parcels ride one kombi, so only stop pairs
// with a direct route can book.
export default async function ParcelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const err = typeof params.err === "string" ? params.err : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const network = await fetchNetwork(supabase);

  const [parcelsRes, statusRes] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        "id, fare_cents, payment_method, purchased_at, from_stop:stops!tickets_from_stop_id_fkey(name), to_stop:stops!tickets_to_stop_id_fkey(name), board_codes(code, valid_until, purpose)",
      )
      .eq("kind", "parcel")
      .order("purchased_at", { ascending: false })
      .limit(5),
    supabase.from("ticket_status").select("ticket_id, status"),
  ]);

  const parcels = (parcelsRes.data ?? []) as unknown as ParcelRow[];
  const statusByTicket = new Map(
    (statusRes.data ?? []).map((s) => [s.ticket_id as string, s.status as string]),
  );

  return (
    <main className="shell">
      <header className="screen-head">
        <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <h1 className="svika-headline">{t(lang, "parcel.title")}</h1>
      </header>

      <section className="svika-card wallet-panel svika-animate-fade-up">
        <form action={bookParcel} className="auth-form">
          <label className="svika-meta" htmlFor="parcel-from">
            {t(lang, "parcel.from")}
          </label>
          <select id="parcel-from" name="from" className="auth-input" required>
            {network.stops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="svika-meta" htmlFor="parcel-to">
            {t(lang, "parcel.to")}
          </label>
          <select
            id="parcel-to"
            name="to"
            className="auth-input"
            defaultValue={network.stops[1]?.id}
            required
          >
            {network.stops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {err && (
            <p className="auth-error svika-body">
              {t(lang, err === "balance" ? "parcel.errBalance" : "parcel.err")}
            </p>
          )}
          <div className="plan-pay">
            <button
              className="auth-submit touch-target"
              type="submit"
              name="payment"
              value="wallet"
            >
              {t(lang, "parcel.payWallet")}
            </button>
            <button
              className="pay-cash touch-target"
              type="submit"
              name="payment"
              value="cash"
            >
              {t(lang, "parcel.payCash")}
            </button>
          </div>
        </form>
      </section>

      <section className="tickets-block">
        <h2 className="svika-meta tickets-heading">{t(lang, "parcel.yours")}</h2>
        {parcels.length === 0 ? (
          <p className="svika-body empty-note">{t(lang, "parcel.none")}</p>
        ) : (
          <ul className="ticket-list">
            {parcels.map((p) => {
              const status = statusByTicket.get(p.id) ?? "issued";
              const statusKey = `ticket.status.${status}` as DictKey;
              const codes = boardCodesOf(
                p.board_codes as Parameters<typeof boardCodesOf>[0],
              ) as { code: string; purpose?: string }[];
              const load = codes.find((c) => c.purpose === "load")?.code ?? "····";
              const collect =
                codes.find((c) => c.purpose === "collect")?.code ?? "····";
              const loadStage =
                status === "issued" ? "active" : status === "loaded" ? "done" : "spent";
              const collectStage =
                status === "issued" ? "waiting" : status === "loaded" ? "active" : "spent";
              return (
                <li key={p.id} className="parcel-item svika-card">
                  <header className="parcel-head">
                    <p className="parcel-endpoints">
                      {p.from_stop?.name} {t(lang, "common.to")} {p.to_stop?.name}
                    </p>
                    <span className="plate-chip">{formatUsd(p.fare_cents)}</span>
                  </header>
                  <div className="parcel-codes">
                    <div
                      className={`parcel-code-panel parcel-stage-${loadStage}`}
                      data-testid="load-panel"
                    >
                      <p className="svika-meta">{t(lang, "parcel.loadCode")}</p>
                      <p
                        className="svika-mono-code parcel-code"
                        data-testid="load-code"
                      >
                        {status === "issued" ? load : "····"}
                      </p>
                      {status === "loaded" && (
                        <p className="svika-meta parcel-stage-note">
                          {t(lang, "ticket.status.loaded")}
                        </p>
                      )}
                    </div>
                    <div
                      className={`parcel-code-panel parcel-stage-${collectStage}`}
                      data-testid="collect-panel"
                    >
                      <p className="svika-meta">{t(lang, "parcel.collectCode")}</p>
                      <p
                        className="svika-mono-code parcel-code"
                        data-testid="collect-code"
                      >
                        {status === "collected" ? "····" : collect}
                      </p>
                      {status === "collected" && (
                        <p className="svika-meta parcel-stage-note">
                          {t(lang, "ticket.status.collected")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="parcel-perf" aria-hidden />
                  <p className="svika-meta parcel-foot">
                    {status === "issued"
                      ? t(lang, "parcel.loadHint")
                      : t(lang, statusKey)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
