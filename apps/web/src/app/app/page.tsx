import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t, type DictKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/roles";
import { SignOutButton } from "@/components/SignOutButton";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LiveMapLazy } from "@/components/map/LiveMapLazy";
import { formatUsd } from "@svika/shared";
import { boardCodesOf, type BoardCodeEmbed } from "@/lib/tickets";

interface TicketRow {
  id: string;
  fare_cents: number;
  payment_method: "wallet" | "cash";
  purchased_at: string;
  routes: { name: string } | null;
  from_stop: { name: string } | null;
  to_stop: { name: string } | null;
  board_codes: BoardCodeEmbed | BoardCodeEmbed[] | null;
}

// Rider home: search a trip, see wallet credit and live tickets. The search
// form degrades to the plan page's stop picker for free text it cannot place.
export default async function RiderHome() {
  const lang = await getLang();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await resolveRole(supabase, user.id);
  const roleKey: DictKey = `role.${role}`;

  const [balanceRes, ticketsRes] = await Promise.all([
    supabase
      .from("account_balances")
      .select("balance_cents")
      .eq("kind", "rider_wallet")
      .maybeSingle(),
    supabase
      .from("tickets")
      .select(
        "id, fare_cents, payment_method, purchased_at, routes(name), from_stop:stops!tickets_from_stop_id_fkey(name), to_stop:stops!tickets_to_stop_id_fkey(name), board_codes(code, valid_until)",
      )
      .eq("kind", "fare")
      .order("purchased_at", { ascending: false })
      .limit(8),
  ]);

  const balance = balanceRes.data?.balance_cents ?? 0;
  const tickets = (ticketsRes.data ?? []) as unknown as TicketRow[];

  // statuses only for the tickets on screen; the rider's full history is
  // unbounded and grows forever
  const statusRes = await supabase
    .from("ticket_status")
    .select("ticket_id, status")
    .in(
      "ticket_id",
      tickets.map((t) => t.id),
    );
  const statusByTicket = new Map(
    (statusRes.data ?? []).map((s) => [s.ticket_id as string, s.status as string]),
  );

  return (
    <main className="shell">
      <header className="shell-top">
        <img className="wordmark" src="/wordmark.svg" alt="Svika" height={24} />
        <div className="shell-top-actions">
          <LanguageToggle lang={lang} />
          <SignOutButton label={t(lang, "app.signOut")} />
        </div>
      </header>

      <section className="map-block svika-animate-fade-up" aria-label="live map">
        <LiveMapLazy
          labels={{
            ariaLabel: t(lang, "map.ariaLabel"),
            demoChip: t(lang, "map.demoChip"),
            unavailable: t(lang, "map.unavailable"),
          }}
        />
      </section>

      <section className="search-card svika-card svika-animate-fade-up">
        <h1 className="svika-headline">{t(lang, "rider.searchTitle")}</h1>
        <form className="search-form" action="/app/plan" method="get">
          <label className="svika-meta" htmlFor="from">
            {t(lang, "rider.fromLabel")}
          </label>
          <input
            id="from"
            name="from"
            className="auth-input"
            placeholder={t(lang, "rider.fromPlaceholder")}
            autoComplete="off"
            required
          />
          <label className="svika-meta" htmlFor="to">
            {t(lang, "rider.toLabel")}
          </label>
          <input
            id="to"
            name="to"
            className="auth-input"
            placeholder={t(lang, "rider.toPlaceholder")}
            autoComplete="off"
            required
          />
          <button className="auth-submit touch-target" type="submit">
            {t(lang, "rider.planCta")}
          </button>
        </form>
      </section>

      <section className="wallet-strip svika-card">
        <div>
          <p className="svika-meta">{t(lang, "rider.walletBalance")}</p>
          <p className="wallet-amount svika-mono-code">{formatUsd(balance)}</p>
        </div>
        <p className="svika-meta">{t(lang, roleKey)}</p>
      </section>

      <nav className="home-nav" aria-label="sections">
        <Link className="home-nav-link touch-target" href="/app/wallet">
          {t(lang, "wallet.open")}
        </Link>
        <Link className="home-nav-link touch-target" href="/app/parcel">
          {t(lang, "parcel.open")}
        </Link>
        {role === "owner" && (
          <Link className="home-nav-link touch-target" href="/app/owner">
            {t(lang, "owner.open")}
          </Link>
        )}
      </nav>

      <section className="tickets-block">
        <h2 className="svika-meta tickets-heading">{t(lang, "rider.tickets")}</h2>
        {tickets.length === 0 ? (
          <p className="svika-body empty-note">{t(lang, "rider.noTickets")}</p>
        ) : (
          <ul className="ticket-list">
            {tickets.map((ticket) => {
              const status = statusByTicket.get(ticket.id) ?? "issued";
              const statusKey = `ticket.status.${status}` as DictKey;
              const code = boardCodesOf(ticket.board_codes)[0]?.code ?? "";
              return (
                <li key={ticket.id}>
                  <Link
                    href={`/app/ticket/${ticket.id}`}
                    className={`ticket-item svika-card${status === "issued" ? "" : " ticket-item-done"}`}
                  >
                    <span className="ticket-item-code svika-mono-code">
                      {status === "issued" ? code : "····"}
                    </span>
                    <span className="ticket-item-body">
                      <span className="svika-body ticket-item-route">
                        {ticket.from_stop && ticket.to_stop
                          ? `${ticket.from_stop.name} → ${ticket.to_stop.name}`
                          : (ticket.routes?.name ?? "")}
                      </span>
                      <span className="svika-meta">
                        {formatUsd(ticket.fare_cents)} ·{" "}
                        {t(
                          lang,
                          ticket.payment_method === "cash"
                            ? "ticket.payCash"
                            : "ticket.paidWallet",
                        )}{" "}
                        · {t(lang, statusKey)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
