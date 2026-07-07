import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t, type DictKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/roles";
import { SignOutButton } from "@/components/SignOutButton";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LiveMapLazy } from "@/components/map/LiveMapLazy";
import { HomeSheet } from "@/components/home/HomeSheet";
import { formatUsd } from "@svika/shared";
import { boardCodesOf, type BoardCodeEmbed } from "@/lib/tickets";
import { etaProvider } from "@/lib/map/eta";

interface SavedTripRow {
  id: string;
  nickname: string;
  from_stop_id: string;
  to_stop_id: string;
  from_stop: { name: string } | null;
  to_stop: { name: string } | null;
}

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

// Rider home: the live map is the whole screen; everything else floats over
// it. A peeking bottom sheet keeps the trip search one thumb away and opens
// into wallet credit and live tickets. The search degrades exactly as
// before: free text the planner cannot place lands on the stop picker.
export default async function RiderHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const justBooked = params.booked === "1";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await resolveRole(supabase, user.id);

  const [balanceRes, savedRes, ticketsRes] = await Promise.all([
    supabase
      .from("account_balances")
      .select("balance_cents")
      .eq("kind", "rider_wallet")
      .maybeSingle(),
    supabase
      .from("saved_trips")
      .select(
        "id, nickname, from_stop_id, to_stop_id, from_stop:stops!saved_trips_from_stop_id_fkey(name), to_stop:stops!saved_trips_to_stop_id_fkey(name)",
      )
      .order("created_at", { ascending: false })
      .limit(4),
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
  const savedTrips = (savedRes.data ?? []) as unknown as SavedTripRow[];
  const tickets = (ticketsRes.data ?? []) as unknown as TicketRow[];

  // the "your kombi is N minutes away" slot: mock ETA adapter until Spine 2
  // lands, and every rendering carries the demo label
  const etaByTrip = new Map<string, number>();
  for (const trip of savedTrips) {
    etaByTrip.set(trip.id, await etaProvider.etaMinutes(trip.from_stop_id));
  }

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
    <main className="home-screen">
      <div className="home-map">
        <LiveMapLazy
          labels={{
            ariaLabel: t(lang, "map.ariaLabel"),
            demoChip: t(lang, "map.demoChip"),
            unavailable: t(lang, "map.unavailable"),
          }}
        />
      </div>

      <header className="home-chips">
        <span className="home-chip svika-glass">
          <img className="wordmark" src="/wordmark.svg" alt="Svika" height={22} />
        </span>
        <span className="home-chip svika-glass">
          <LanguageToggle lang={lang} />
        </span>
      </header>

      <HomeSheet
        openLabel={t(lang, "home.sheetOpen")}
        closeLabel={t(lang, "home.sheetClose")}
        defaultOpen={justBooked}
        peek={
          <>
            <h1 className="svika-headline home-sheet-title">
              {t(lang, "rider.searchTitle")}
            </h1>
            <p className="svika-meta home-sheet-hint">{t(lang, "home.sheetHint")}</p>
            <form className="home-search" action="/app/plan" method="get">
              <input
                id="from"
                name="from"
                className="home-search-pill"
                placeholder={t(lang, "rider.fromPlaceholder")}
                aria-label={t(lang, "rider.fromLabel")}
                autoComplete="off"
                required
              />
              <div className="home-search-row">
                <input
                  id="to"
                  name="to"
                  className="home-search-pill"
                  placeholder={t(lang, "rider.toPlaceholder")}
                  aria-label={t(lang, "rider.toLabel")}
                  autoComplete="off"
                  required
                />
                <button
                  className="home-search-go touch-target"
                  type="submit"
                  aria-label={t(lang, "rider.planCta")}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M4 10.1c0-.72.58-1.3 1.3-1.3H12V6.1c0-1.28 1.5-1.94 2.42-1.05l6.28 6.05c.6.58.6 1.54 0 2.12l-6.28 6.05C13.5 20.16 12 19.5 12 18.22V15.5H5.3A1.3 1.3 0 0 1 4 14.2z" />
                  </svg>
                </button>
              </div>
            </form>
          </>
        }
      >
        {savedTrips.length > 0 && (
          <section className="home-picks" aria-label={t(lang, "home.yourTrips")}>
            <h2 className="svika-meta tickets-heading">{t(lang, "home.yourTrips")}</h2>
            <ul className="home-pick-list">
              {savedTrips.map((trip) => (
                <li key={trip.id}>
                  <Link
                    className="home-pick svika-card touch-target"
                    href={`/app/plan?from=${trip.from_stop_id}&to=${trip.to_stop_id}`}
                  >
                    <span className="home-pick-body">
                      <span className="svika-body home-pick-name">{trip.nickname}</span>
                      <span className="svika-meta">
                        {trip.from_stop?.name} → {trip.to_stop?.name}
                      </span>
                    </span>
                    <span className="home-pick-eta">
                      <span className="svika-mono-code">
                        ~{etaByTrip.get(trip.id)} {t(lang, "common.minutes")}
                      </span>
                      <span className="svika-meta home-pick-demo">
                        {t(lang, "home.etaDemo")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="wallet-strip svika-card">
          <div>
            <p className="svika-meta">{t(lang, "rider.walletBalance")}</p>
            <p className="wallet-amount svika-mono-code">{formatUsd(balance)}</p>
          </div>
          <Link className="home-nav-link touch-target" href="/app/wallet">
            {t(lang, "wallet.open")}
          </Link>
        </section>

        <nav className="home-nav" aria-label="sections">
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

        <footer className="home-sheet-footer">
          <SignOutButton label={t(lang, "app.signOut")} />
        </footer>
      </HomeSheet>
    </main>
  );
}
