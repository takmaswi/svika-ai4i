"use server";

// Server actions for the rider flows. Every money move goes through the
// security definer RPCs (the ledger is the only money path); these actions
// only relay the signed-in user's intent, never touch tables directly.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchNetwork } from "@/lib/network";
import { dollarsToCents, planTrip, type RideLeg } from "@svika/shared";

export interface PurchasedTicket {
  ticketId: string;
  boardCode: string;
  fareCents: number;
}

/**
 * Buys one ticket per ride leg of the planned trip (wallet debit or cash
 * reservation), then lands on the rider home where the codes are shown.
 * Legs are re-planned server side from the stop pair: the client only sends
 * where it wants to go and how to pay, never fares or routes.
 */
export async function bookTrip(formData: FormData): Promise<void> {
  const fromStop = String(formData.get("from") ?? "");
  const toStop = String(formData.get("to") ?? "");
  const payment = String(formData.get("payment") ?? "wallet");
  if (!fromStop || !toStop) redirect("/app");
  if (payment !== "wallet" && payment !== "cash") redirect("/app");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const network = await fetchNetwork(supabase);
  const plan = planTrip(network, fromStop, toStop);
  if (!plan) redirect(`/app/plan?from=${fromStop}&to=${toStop}&err=noroute`);

  const rideLegs = plan.legs.filter((l): l is RideLeg => l.type === "ride");
  for (const leg of rideLegs) {
    const { error } = await supabase.rpc("purchase_ticket", {
      p_route: leg.routeId,
      p_direction: leg.direction,
      p_from_stop: leg.boardStopId,
      p_to_stop: leg.alightStopId,
      p_payment: payment,
    });
    if (error) {
      const err = error.message.includes("insufficient") ? "balance" : "purchase";
      redirect(`/app/plan?from=${fromStop}&to=${toStop}&err=${err}`);
    }
  }

  redirect("/app?booked=1");
}

/** Parks wallet credit in escrow under a claim code (shown on the wallet page). */
export async function sendCredit(formData: FormData): Promise<void> {
  const raw = String(formData.get("amount") ?? "").replace(",", ".");
  const dollars = Number(raw);
  if (!Number.isFinite(dollars) || dollars <= 0) redirect("/app/wallet?err=send");

  const supabase = await createClient();
  const { error } = await supabase.rpc("send_credit", {
    p_amount_cents: dollarsToCents(dollars),
  });
  if (error) redirect("/app/wallet?err=send");
  redirect("/app/wallet?sent=1");
}

/** Claims credit by code into the signed-in rider's wallet. */
export async function claimCredit(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) redirect("/app/wallet");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_credit", { p_code: code });
  if (error) redirect("/app/wallet?claim=invalid_code");
  const outcome =
    (data as { outcome: string }[] | null)?.[0]?.outcome ?? "invalid_code";
  redirect(`/app/wallet?claim=${outcome}`);
}

/** Sender takes an unclaimed transfer back; escrow returns to their wallet. */
export async function cancelTransfer(formData: FormData): Promise<void> {
  const id = String(formData.get("transfer") ?? "");
  if (!id) redirect("/app/wallet");

  const supabase = await createClient();
  await supabase.rpc("cancel_transfer", { p_transfer: id });
  redirect("/app/wallet");
}

/**
 * Books a parcel between two stops. Parcels ride one kombi, so the pair must
 * plan as a single direct leg; anything needing a transfer is refused with a
 * clear message instead of quietly booking half a journey.
 */
export async function bookParcel(formData: FormData): Promise<void> {
  const fromStop = String(formData.get("from") ?? "");
  const toStop = String(formData.get("to") ?? "");
  const payment = String(formData.get("payment") ?? "wallet");
  if (!fromStop || !toStop || fromStop === toStop) {
    redirect("/app/parcel?err=stops");
  }
  if (payment !== "wallet" && payment !== "cash") redirect("/app/parcel");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const network = await fetchNetwork(supabase);
  const plan = planTrip(network, fromStop, toStop);
  const rides = plan?.legs.filter((l): l is RideLeg => l.type === "ride") ?? [];
  if (!plan || plan.legs.length !== 1 || rides.length !== 1) {
    redirect("/app/parcel?err=direct");
  }

  const leg = rides[0]!;
  const { error } = await supabase.rpc("purchase_parcel", {
    p_route: leg.routeId,
    p_direction: leg.direction,
    p_from_stop: leg.boardStopId,
    p_to_stop: leg.alightStopId,
    p_payment: payment,
  });
  if (error) {
    const err = error.message.includes("insufficient") ? "balance" : "book";
    redirect(`/app/parcel?err=${err}`);
  }
  redirect("/app/parcel?booked=1");
}
