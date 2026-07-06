"use server";

// Server actions for the rider flows. Every money move goes through the
// security definer RPCs (the ledger is the only money path); these actions
// only relay the signed-in user's intent, never touch tables directly.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchNetwork } from "@/lib/network";
import { planTrip, type RideLeg } from "@svika/shared";

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
      const err = error.message.includes("insufficient")
        ? "balance"
        : "purchase";
      redirect(`/app/plan?from=${fromStop}&to=${toStop}&err=${err}`);
    }
  }

  redirect("/app?booked=1");
}
