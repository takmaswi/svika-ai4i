import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getLang, t, type DictKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { formatUsd } from "@svika/shared";
import { boardCodesOf, type BoardCodeEmbed } from "@/lib/tickets";

interface TicketDetail {
  id: string;
  fare_cents: number;
  payment_method: "wallet" | "cash";
  direction: "outbound" | "inbound";
  routes: { name: string } | null;
  from_stop: { name: string } | null;
  to_stop: { name: string } | null;
  board_codes: BoardCodeEmbed | BoardCodeEmbed[] | null;
}

// The ticket as a boarding card: forest route strip, one big mono code the
// hwindi can read from across the kombi, a perforated fold, and the stamp
// moment when the fare clears. RLS means a rider can only ever open their
// own ticket here.
export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const lang = await getLang();
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [ticketRes, statusRes] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        "id, fare_cents, payment_method, direction, routes(name), from_stop:stops!tickets_from_stop_id_fkey(name), to_stop:stops!tickets_to_stop_id_fkey(name), board_codes(code, valid_until)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("ticket_status").select("status").eq("ticket_id", id).maybeSingle(),
  ]);

  const ticket = ticketRes.data as unknown as TicketDetail | null;
  if (!ticket) notFound();

  const status = (statusRes.data?.status as string) ?? "issued";
  const statusKey = `ticket.status.${status}` as DictKey;
  const boardCode = boardCodesOf(ticket.board_codes)[0];
  const validUntil = boardCode
    ? new Date(boardCode.valid_until).toLocaleTimeString("en-ZW", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const routeLine =
    ticket.from_stop && ticket.to_stop
      ? `${ticket.from_stop.name} → ${ticket.to_stop.name}`
      : (ticket.routes?.name ?? "");
  const isLive = status === "issued";
  const isStamped = status === "redeemed";

  return (
    <main className="shell">
      <header className="shell-top">
        <Link href="/app" className="auth-link">
          ← {t(lang, "common.back")}
        </Link>
      </header>

      <article
        className={`boarding-card svika-animate-fade-up${isLive ? "" : " boarding-card-done"}`}
        data-status={status}
      >
        <header className="boarding-strip">
          <span className="svika-meta boarding-strip-route">{routeLine}</span>
          <span className="svika-mono-code boarding-strip-fare">
            {formatUsd(ticket.fare_cents)}
          </span>
        </header>

        <div className="boarding-body">
          <p className="svika-meta boarding-label">{t(lang, "ticket.title")}</p>
          <p className="ticket-code" data-testid="board-code">
            {boardCode?.code ?? "····"}
          </p>
          {isLive && (
            <p className="svika-body ticket-hint">{t(lang, "ticket.showHwindi")}</p>
          )}
          {!isLive && !isStamped && (
            <p className="ticket-status svika-meta">{t(lang, statusKey)}</p>
          )}
          {isStamped && (
            // outer span owns the centring transform; the stamp animation
            // owns transform on the inner one, they must not share
            <span className="boarding-stamp-anchor" aria-hidden>
              <span className="boarding-stamp svika-animate-stamp">
                {t(lang, statusKey)}
              </span>
            </span>
          )}
        </div>

        <div className="boarding-perf" aria-hidden />

        <dl className="boarding-facts">
          <div>
            <dt className="svika-meta">{t(lang, "ticket.fare")}</dt>
            <dd className="svika-mono-code">{formatUsd(ticket.fare_cents)}</dd>
          </div>
          <div>
            <dt className="svika-meta">{t(lang, "ticket.payment")}</dt>
            <dd>
              <span
                className={`svika-body boarding-pay${
                  ticket.payment_method === "cash" && isLive ? " boarding-cash" : ""
                }`}
              >
                {t(
                  lang,
                  ticket.payment_method === "cash"
                    ? "ticket.payCash"
                    : "ticket.paidWallet",
                )}
              </span>
            </dd>
          </div>
          {isLive && validUntil && (
            <div>
              <dt className="svika-meta">{t(lang, "ticket.validUntil")}</dt>
              <dd className="svika-mono-code">{validUntil}</dd>
            </div>
          )}
        </dl>
      </article>
    </main>
  );
}
