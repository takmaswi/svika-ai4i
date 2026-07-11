"use server";

// The one real call in Gogo's USSD scene: how far the kombi is, answered by
// the same eta wiring the home screen uses (spine when configured, the mock
// twin otherwise, basis flag carried either way). Read only, no session.
import { createClient } from "@/lib/supabase/server";
import { CORRIDOR_ROUTE_CODE } from "@/lib/map/corridor-data";
import { homeEtaProvider } from "@/lib/map/eta-home";

export async function gogoKombiEta(): Promise<{ minutes: number; isMock: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("route_stops")
    .select("stop_id, seq, routes!inner(code)")
    .eq("routes.code", CORRIDOR_ROUTE_CODE)
    .eq("direction", "outbound")
    .order("seq");
  const stopIds = (data ?? []).map((r) => r.stop_id as string);
  if (stopIds.length < 2) throw new Error("corridor unavailable");
  const eta = await homeEtaProvider(stopIds).estimate(
    stopIds[0]!,
    stopIds[stopIds.length - 1]!,
  );
  return { minutes: eta.minutes, isMock: eta.isMock };
}
