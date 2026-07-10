"use server";

// The demo door and the story engine. Judges enter as pooled demo personas
// on the same backend (claim_demo_persona hands out the least recently used
// persona; demo_reset_mine rebuilds its fixture state), and story steps run
// real writes through the same RPCs every user hits. The simulated hwindi is
// a real conductor account the server signs in for one call; its credentials
// stay server side, and the captions say the actor is simulated.
import { redirect } from "next/navigation";
import { createClient as createBareClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { fetchNetwork } from "@/lib/network";
import { boardCodesOf } from "@/lib/tickets";
import { STORIES, storyUrl, type StoryActionId } from "@/lib/stories";
import {
  CONSENT_VERSION,
  planTrip,
  resolveStopQuery,
  type RideLeg,
} from "@svika/shared";

const DEMO_ERR = "/?demoerr=1";

/** The landing page demo door: one tap into a fresh demo persona. */
export async function enterDemo(formData: FormData): Promise<void> {
  const target = String(formData.get("target") ?? "rider");
  const story = String(formData.get("story") ?? "");
  const supabase = await createClient();

  if (target === "owner") {
    const email = process.env.DEMO_OWNER_EMAIL;
    const password = process.env.DEMO_OWNER_PASSWORD;
    if (!email || !password) redirect(DEMO_ERR);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) redirect(DEMO_ERR);
    redirect("/app/owner");
  }

  const password = process.env.DEMO_JUDGE_PASSWORD;
  if (!password) redirect(DEMO_ERR);

  const { data: email, error: claimErr } = await supabase.rpc("claim_demo_persona");
  if (claimErr || typeof email !== "string") redirect(DEMO_ERR);

  const { error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr) redirect(DEMO_ERR);

  const { error: resetErr } = await supabase.rpc("demo_reset_mine", {
    p_consent_version: CONSENT_VERSION,
  });
  if (resetErr) redirect(DEMO_ERR);

  redirect(story in STORIES ? storyUrl(story, 0) : "/app");
}

/** Runs the current story step's engine action, then advances the story. */
export async function storyAdvance(formData: FormData): Promise<void> {
  const slug = String(formData.get("story") ?? "");
  const step = Number(formData.get("step") ?? -1);
  const current = STORIES[slug]?.steps[step];
  if (!current?.action) redirect("/app");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // stories write demo data; only demo personas may drive them
  const { data: profile } = await supabase
    .from("profiles")
    .select("demo_sim")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.demo_sim) redirect("/app");

  const ok = await runAction(current.action);
  if (!ok) redirect(`${storyUrl(slug, step)}&err=story`);
  redirect(storyUrl(slug, step + 1));
}

async function runAction(action: StoryActionId): Promise<boolean> {
  switch (action) {
    case "book-cash-town":
      return bookByName("heights", "rezende", "cash");
    case "book-wallet-transfer":
      return bookByName("heights", "avondale", "wallet");
    case "hwindi-clears":
      return hwindiClearsLatest();
  }
}

/** Books like the plan page does: resolve, re-plan server side, purchase. */
async function bookByName(
  fromQuery: string,
  toQuery: string,
  payment: "wallet" | "cash",
): Promise<boolean> {
  const supabase = await createClient();
  const network = await fetchNetwork(supabase);
  const from = resolveStopQuery(network, fromQuery).match;
  const to = resolveStopQuery(network, toQuery).match;
  if (!from || !to) return false;
  const plan = planTrip(network, from.id, to.id);
  if (!plan) return false;

  const rideLegs = plan.legs.filter((l): l is RideLeg => l.type === "ride");
  for (const leg of rideLegs) {
    const { error } = await supabase.rpc("purchase_ticket", {
      p_route: leg.routeId,
      p_direction: leg.direction,
      p_from_stop: leg.boardStopId,
      p_to_stop: leg.alightStopId,
      p_payment: payment,
    });
    if (error) return false;
  }
  return true;
}

/**
 * The simulated hwindi: signs in as the demo conductor (a real account with
 * a real route assignment) and clears the persona's newest issued cash fare
 * through the same redeem and change RPCs a phone would call, keying in a
 * $2 note so the 50 cents of change lands as wallet credit.
 */
async function hwindiClearsLatest(): Promise<boolean> {
  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, route_id, direction, board_codes(code, valid_until)")
    .eq("kind", "fare")
    .order("purchased_at", { ascending: false })
    .limit(3);
  if (!tickets || tickets.length === 0) return false;

  const { data: statuses } = await supabase
    .from("ticket_status")
    .select("ticket_id, status")
    .in(
      "ticket_id",
      tickets.map((t) => t.id),
    );
  const statusOf = new Map(
    (statuses ?? []).map((s) => [s.ticket_id as string, s.status as string]),
  );
  const live = tickets.find((t) => (statusOf.get(t.id) ?? "issued") === "issued");
  if (!live) return false;
  const codes = boardCodesOf(live.board_codes as Parameters<typeof boardCodesOf>[0]);
  const code = codes[0]?.code;
  if (!code) return false;

  const email = process.env.DEMO_CONDUCTOR_EMAIL;
  const password = process.env.DEMO_CONDUCTOR_PASSWORD;
  if (!email || !password) return false;
  const conductor = createBareClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { error: signErr } = await conductor.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr) return false;

  const { data: redeemed, error: redeemErr } = await conductor.rpc(
    "redeem_board_code",
    { p_route: live.route_id, p_direction: live.direction, p_code: code },
  );
  const outcome = (redeemed as { outcome?: string }[] | null)?.[0]?.outcome;
  if (redeemErr || outcome !== "success") return false;

  const { error: changeErr } = await conductor.rpc("record_change_credit", {
    p_ticket: live.id,
    p_note_cents: 200,
  });
  return !changeErr;
}
