// Money is always integer USD cents across Svika. Never store or pass floats:
// the ledger is cents, fares are cents, wallet balances are cents. These helpers
// are the single place dollars and cents convert, so rounding lives in one spot.

export const CURRENCY = "USD" as const;

/** Whole cents from a dollar amount, rounded to the nearest cent. */
export function dollarsToCents(dollars: number): number {
  if (!Number.isFinite(dollars)) {
    throw new Error("dollarsToCents: amount must be a finite number");
  }
  return Math.round(dollars * 100);
}

/** Dollars (may be fractional) from whole cents. */
export function centsToDollars(cents: number): number {
  assertWholeCents(cents);
  return cents / 100;
}

/** Display a cent amount as USD, e.g. 150 -> "$1.50". */
export function formatUsd(cents: number): string {
  assertWholeCents(cents);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = (abs % 100).toString().padStart(2, "0");
  return `${sign}$${dollars}.${remainder}`;
}

function assertWholeCents(cents: number): void {
  if (!Number.isInteger(cents)) {
    throw new Error(`money amount must be whole cents, got ${cents}`);
  }
}
