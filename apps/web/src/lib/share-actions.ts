"use server";

// Share my ride: minting and killing the tokenised link. Both actions are
// thin relays into the security definer RPCs; the token itself never rides
// a query string on our side (the ticket page reads it back under RLS).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createRideShare(formData: FormData): Promise<void> {
  const ticket = String(formData.get("ticket") ?? "");
  if (!ticket) redirect("/app");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_ride_share", {
    p_ticket: ticket,
  });
  if (error) redirect(`/app/ticket/${ticket}?share=err`);
  redirect(`/app/ticket/${ticket}?share=live`);
}

export async function revokeRideShare(formData: FormData): Promise<void> {
  const ticket = String(formData.get("ticket") ?? "");
  const share = String(formData.get("share") ?? "");
  if (!ticket || !share) redirect("/app");

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_ride_share", {
    p_share: share,
  });
  if (error) redirect(`/app/ticket/${ticket}?share=err`);
  redirect(`/app/ticket/${ticket}?share=revoked`);
}
