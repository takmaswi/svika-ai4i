// Fare rules shared by the planner, purchase path and owner views. Real 2026
// corridor fares land in fare_segments (dated) during P1 from fieldwork; these
// bounds are guard rails, not invented prices. A fare outside the band is a data
// error we refuse rather than silently charge.

/** 2026 sanity band for a single kombi leg, in USD cents ($0.50 to $3.00). */
export const MIN_FARE_CENTS = 50;
export const MAX_FARE_CENTS = 300;

export function isPlausibleFareCents(cents: number): boolean {
  return Number.isInteger(cents) && cents >= MIN_FARE_CENTS && cents <= MAX_FARE_CENTS;
}

/** Throw if a fare is outside the plausible band; returns the fare otherwise. */
export function assertPlausibleFareCents(cents: number): number {
  if (!isPlausibleFareCents(cents)) {
    throw new Error(
      `fare ${cents}c is outside the plausible band ` +
        `[${MIN_FARE_CENTS}, ${MAX_FARE_CENTS}]`,
    );
  }
  return cents;
}
