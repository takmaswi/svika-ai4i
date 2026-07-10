import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getLang, t, type DictKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { formatUsd } from "@svika/shared";
import { BackIcon } from "@/components/icons";
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

// The ticket (reference screen 4): a char card on white by day, a white card
// on char by night. One big mono code the hwindi can read from across the
// kombi, a perforated fold, and the stamp moment when the fare clears. RLS
// means a rider can only ever open their own ticket here.
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
  const endpointsLine =
    ticket.from_stop && ticket.to_stop
      ? `${ticket.from_stop.name} ${t(lang, "common.to")} ${ticket.to_stop.name}`
      : "";
  const isLive = status === "issued";
  const isStamped = status === "redeemed";

  return (
    <main className="shell">
      <header className="screen-head">
        <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <h1 className="svika-headline">{t(lang, "ticket.title")}</h1>
      </header>

      <article
        className={`boarding-card svika-animate-fade-up${isLive ? "" : " boarding-card-done"}`}
        data-status={status}
      >
        <div className="boarding-head">
          <div>
            <p className="boarding-route">{ticket.routes?.name ?? ""}</p>
            {endpointsLine && <p className="boarding-endpoints">{endpointsLine}</p>}
          </div>
          <span className="ticket-chip">{formatUsd(ticket.fare_cents)}</span>
        </div>
        {!isLive && !isStamped && (
          <div className="boarding-head">
            <span className="boarding-status">{t(lang, statusKey)}</span>
          </div>
        )}

        <div className="boarding-perf" aria-hidden />

        <div className="boarding-body">
          <p className="boarding-label">{t(lang, "ticket.title")}</p>
          <p className="ticket-code" data-testid="board-code">
            {boardCode?.code ?? "····"}
          </p>
          {isLive && (
            <p className="ticket-hint">{t(lang, "ticket.showHwindi")}</p>
          )}
          <div className="boarding-pay-row">
            <span className="boarding-fare">{formatUsd(ticket.fare_cents)}</span>
            <span
              className={`pay-chip${
                ticket.payment_method === "cash" ? " pay-chip-cash" : ""
              }`}
            >
              {t(
                lang,
                ticket.payment_method === "cash"
                  ? "ticket.payCash"
                  : "ticket.paidWallet",
              )}
            </span>
          </div>
          {isLive && validUntil && (
            <p className="boarding-valid">
              {t(lang, "ticket.validUntil")}{" "}
              <span className="svika-mono-code">{validUntil}</span>
            </p>
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
      </article>
    </main>
  );
}
