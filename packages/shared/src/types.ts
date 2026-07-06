// Cross-surface domain types that mirror the database enums (packages/db).
// Kept in lockstep with the migrations by hand for now; the generated
// database.types.ts remains the source of truth for table row shapes.

export type AppLanguage = "en" | "sn";

export type RouteDirection = "outbound" | "inbound";

export type TicketStatus = "issued" | "redeemed" | "cancelled" | "expired" | "refunded";
