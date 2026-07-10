import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t, type DictKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { sendCredit, claimCredit, cancelTransfer } from "@/lib/actions";
import { formatUsd } from "@svika/shared";

interface PostingRow {
  amount_cents: number;
  created_at: string;
  ledger_transactions: { kind: string; memo: string | null } | null;
}

interface TransferRow {
  id: string;
  amount_cents: number;
  claim_code: string;
  expires_at: string;
  transfer_events: { event_type: string; created_at: string }[];
}

// The wallet: ledger derived balance, history, and the transfer flows.
// Sending parks credit in escrow under a claim code; the code lives here,
// never in a URL.
export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const claimOutcome = typeof params.claim === "string" ? params.claim : "";
  const err = typeof params.err === "string" ? params.err : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [balanceRes, accountsRes, transfersRes] = await Promise.all([
    supabase
      .from("account_balances")
      .select("balance_cents")
      .eq("kind", "rider_wallet")
      .maybeSingle(),
    supabase.from("ledger_accounts").select("id"),
    supabase
      .from("credit_transfers")
      .select(
        "id, amount_cents, claim_code, expires_at, transfer_events(event_type, created_at)",
      )
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const accountIds = (accountsRes.data ?? []).map((a) => a.id as string);
  const { data: postings } = await supabase
    .from("ledger_postings")
    .select("amount_cents, created_at, ledger_transactions(kind, memo)")
    .in("account_id", accountIds)
    .order("created_at", { ascending: false })
    .limit(12);

  const balance = balanceRes.data?.balance_cents ?? 0;
  const history = (postings ?? []) as unknown as PostingRow[];
  // the change story: every cent a hwindi could not hand back, kept as credit
  const changeTotal = history
    .filter((h) => h.ledger_transactions?.kind === "change_credit" && h.amount_cents > 0)
    .reduce((sum, h) => sum + h.amount_cents, 0);
  const transfers = ((transfersRes.data ?? []) as unknown as TransferRow[]).filter(
    (tr) => {
      const latest = [...tr.transfer_events].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      )[0];
      return latest?.event_type === "sent";
    },
  );

  const claimMsgKey: DictKey | null =
    claimOutcome === "success"
      ? "wallet.claimed"
      : claimOutcome === "invalid_code"
        ? "wallet.claimInvalid"
        : claimOutcome === "already_claimed"
          ? "wallet.claimAlready"
          : claimOutcome === "rate_limited"
            ? "wallet.claimRateLimited"
            : null;

  return (
    <main className="shell">
      <header className="shell-top">
        <Link href="/app" className="auth-link">
          ← {t(lang, "common.back")}
        </Link>
      </header>

      <section className="wallet-strip svika-card svika-animate-fade-up">
        <div>
          <p className="svika-meta">{t(lang, "wallet.title")}</p>
          <p className="wallet-amount svika-mono-code" data-testid="wallet-balance">
            {formatUsd(balance)}
          </p>
        </div>
      </section>

      <section className="svika-card wallet-panel wallet-change" data-testid="change-story">
        <div className="watchdog-head">
          <h2 className="svika-headline wallet-change-title">
            <span className="svika-pulse-dot" aria-hidden /> {t(lang, "wallet.changeTitle")}
          </h2>
          {changeTotal > 0 && (
            <span className="svika-meta watchdog-label">
              {t(lang, "wallet.changeTotal")}
            </span>
          )}
        </div>
        {changeTotal > 0 ? (
          <>
            <p className="wallet-change-amount svika-mono-code">
              {formatUsd(changeTotal)}
            </p>
            <p className="svika-body empty-note">{t(lang, "wallet.changeBody")}</p>
          </>
        ) : (
          <p className="svika-body empty-note">{t(lang, "wallet.changeNone")}</p>
        )}
      </section>

      <section className="svika-card wallet-panel">
        <h2 className="svika-headline">{t(lang, "wallet.sendTitle")}</h2>
        <p className="svika-meta empty-note">{t(lang, "wallet.sendHint")}</p>
        <form action={sendCredit} className="wallet-inline-form">
          <input
            name="amount"
            inputMode="decimal"
            placeholder="1.00"
            aria-label={t(lang, "wallet.sendAmount")}
            className="auth-input"
            required
          />
          <button className="auth-submit touch-target wallet-inline-cta" type="submit">
            {t(lang, "wallet.sendCta")}
          </button>
        </form>
        {err === "send" && (
          <p className="auth-error svika-body">{t(lang, "wallet.sendErr")}</p>
        )}

        {transfers.length > 0 && (
          <ul className="transfer-list">
            {transfers.map((tr) => (
              <li key={tr.id} className="transfer-item">
                <div>
                  <p className="svika-meta">
                    {t(lang, "wallet.sent")} · {formatUsd(tr.amount_cents)} ·{" "}
                    {t(lang, "wallet.pending")}
                  </p>
                  <p className="transfer-code svika-mono-code" data-testid="claim-code">
                    {tr.claim_code}
                  </p>
                </div>
                <form action={cancelTransfer}>
                  <input type="hidden" name="transfer" value={tr.id} />
                  <button className="auth-link" type="submit">
                    {t(lang, "wallet.cancel")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="svika-card wallet-panel">
        <h2 className="svika-headline">{t(lang, "wallet.claimTitle")}</h2>
        <form action={claimCredit} className="wallet-inline-form">
          <input
            name="code"
            autoComplete="off"
            placeholder="AB2CD3"
            aria-label={t(lang, "wallet.claimLabel")}
            className="auth-input wallet-claim-input"
            required
          />
          <button className="auth-submit touch-target wallet-inline-cta" type="submit">
            {t(lang, "wallet.claimCta")}
          </button>
        </form>
        {claimMsgKey && (
          <p
            className={`svika-body ${claimOutcome === "success" ? "wallet-ok" : "auth-error"}`}
            data-testid="claim-result"
          >
            {t(lang, claimMsgKey)}
          </p>
        )}
      </section>

      <section className="svika-card wallet-panel">
        <h2 className="svika-meta tickets-heading">{t(lang, "wallet.history")}</h2>
        <ul className="history-list">
          {history.map((h, i) => {
            const kind = h.ledger_transactions?.kind ?? "adjustment";
            const key = `wallet.txn.${kind}` as DictKey;
            const isChange = kind === "change_credit";
            return (
              <li key={i} className="history-item">
                <span className="svika-body history-kind">
                  {isChange && <span className="svika-pulse-dot" aria-hidden />}
                  {t(lang, key)}
                </span>
                <span
                  className={`svika-mono-code ${h.amount_cents > 0 ? "wallet-ok" : ""}`}
                >
                  {formatUsd(h.amount_cents)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
