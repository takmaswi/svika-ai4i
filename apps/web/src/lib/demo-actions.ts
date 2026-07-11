"use server";

// The demo door and the story engine. Judges enter as pooled demo personas
// or as the named story personas (Takunda, Rudo) on the same backend, and
// story steps run real writes through the same RPCs every user hits. The
// simulated actors (the hwindi, Rudo's friend) are real accounts the server
// signs in for one call; their credentials stay server side, and the
// captions say the actor is simulated.
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient as createBareClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { fetchNetwork } from "@/lib/network";
import { boardCodesOf } from "@/lib/tickets";
import { THEME_COOKIE } from "@/lib/theme";
import {
  SHARE_PATH_SENTINEL,
  STORIES,
  storyUrl,
  type Story,
  type StoryActionId,
} from "@/lib/stories";
import {
  CONSENT_VERSION,
  planTrip,
  resolveStopQuery,
  type RideLeg,
} from "@svika/shared";

const DEMO_ERR = "/?demoerr=1";
const TAKUNDA_EMAIL = "demo.takunda@svika.app";
const RUDO_EMAIL = "demo.rudo@svika.app";
const TAKUNDA_HISTORY_DAYS = 14;

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

  const def: Story | undefined = STORIES[story];

  // named personas own their stories; pooled Tariros carry everything else
  if (def && def.persona !== "pool") {
    const email = def.persona === "takunda" ? TAKUNDA_EMAIL : RUDO_EMAIL;
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr) redirect(DEMO_ERR);
    const ok =
      def.persona === "takunda"
        ? await resetTakunda(supabase)
        : await resetRudo(supabase);
    if (!ok) redirect(DEMO_ERR);
    if (def.theme) {
      (await cookies()).set(THEME_COOKIE, def.theme, {
        path: "/",
        sameSite: "lax",
      });
    }
    redirect(storyUrl(story, 0));
  }

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

/** Rebuilds Takunda's fixture state: the $5 float, fresh consent, the alert
 *  and voice prefs, the Kubasa quick pick, and the two week commute history
 *  centred on this visit's clock (fixture tickets, enumerated per row in
 *  demo_commute_fixtures; no money moves for them). */
async function resetTakunda(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error: floatErr } = await supabase.rpc("demo_float_mine", {
    p_target_cents: 500,
  });
  if (floatErr) return false;
  await supabase.from("consent_records").insert({
    user_id: user.id,
    action: "accepted",
    version: CONSENT_VERSION,
  });
  const { error: prefErr } = await supabase.from("rider_prefs").upsert(
    { rider_id: user.id, commute_alerts: true, voice_en: true, voice_sn: true },
    { onConflict: "rider_id" },
  );
  if (prefErr) return false;

  const corridor = await corridorEnds(supabase);
  if (!corridor) return false;
  await supabase.from("saved_trips").upsert(
    {
      rider_id: user.id,
      from_stop_id: corridor.from,
      to_stop_id: corridor.to,
      nickname: "Kubasa",
    },
    { onConflict: "rider_id,from_stop_id,to_stop_id" },
  );

  // same shape the seed builds: one ride per day, a few minutes before now
  const rides = [];
  for (let d = 0; d < TAKUNDA_HISTORY_DAYS; d++) {
    const jitterMinutes = 6 + ((d * 7) % 20);
    const at = new Date(Date.now() - d * 24 * 60 * 60_000 - jitterMinutes * 60_000);
    rides.push({ at: at.toISOString() });
  }
  const { error: histErr } = await supabase.rpc("reset_demo_commute_history", {
    p_profile: user.id,
    p_route: corridor.routeId,
    p_direction: "outbound",
    p_from: corridor.from,
    p_to: corridor.to,
    p_fare_cents: 150,
    p_rides: rides,
  });
  return !histErr;
}

/** Rudo's fixture state: a stolen wallet (zero float) and fresh consent. */
async function resetRudo(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { error: floatErr } = await supabase.rpc("demo_float_mine", {
    p_target_cents: 0,
  });
  if (floatErr) return false;
  await supabase.from("consent_records").insert({
    user_id: user.id,
    action: "accepted",
    version: CONSENT_VERSION,
  });
  return true;
}

async function corridorEnds(supabase: SupabaseClient): Promise<{
  routeId: string;
  from: string;
  to: string;
} | null> {
  const { data: route } = await supabase
    .from("routes")
    .select("id")
    .eq("code", "HEIGHTS-REZENDE")
    .maybeSingle();
  if (!route) return null;
  const { data: stops } = await supabase
    .from("route_stops")
    .select("stop_id, seq")
    .eq("route_id", route.id)
    .eq("direction", "outbound")
    .order("seq");
  if (!stops || stops.length < 2) return null;
  return {
    routeId: route.id,
    from: stops[0]!.stop_id,
    to: stops[stops.length - 1]!.stop_id,
  };
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

  // the mother's view step: swap the sentinel for the live share link
  const next = STORIES[slug]?.steps[step + 1];
  if (next?.path === SHARE_PATH_SENTINEL) {
    const { data: share } = await supabase
      .from("ride_shares")
      .select("token")
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (share?.token) {
      redirect(`/share/${share.token}?story=${slug}&step=${step + 1}`);
    }
    redirect(`${storyUrl(slug, step)}&err=story`);
  }
  redirect(storyUrl(slug, step + 1));
}

async function runAction(action: StoryActionId): Promise<boolean> {
  switch (action) {
    case "book-cash-town":
      return bookByName("heights", "rezende", "cash");
    case "book-wallet-transfer":
      return bookByName("heights", "avondale", "wallet");
    case "book-wallet-corridor":
      return bookByName("heights", "rezende", "wallet");
    case "hwindi-clears":
      return hwindiClearsLatest();
    case "friend-sends":
      return friendSendsCredit();
    case "claim-friend-code":
      return claimFriendCode();
    case "share-ride":
      return shareLatestRide();
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

/** A one call session as another demo account, credentials server side. */
async function signInActor(
  email: string | undefined,
  password: string | undefined,
): Promise<SupabaseClient | null> {
  if (!email || !password) return null;
  const actor = createBareClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await actor.auth.signInWithPassword({ email, password });
  return error ? null : actor;
}

/**
 * The simulated hwindi: signs in as the demo conductor (a real account with
 * a real route assignment) and clears the persona's newest issued fare
 * through the same redeem RPC a phone would call. For a cash fare it also
 * keys in a $2 note so the change lands as wallet credit; a wallet fare has
 * no change to key.
 */
async function hwindiClearsLatest(): Promise<boolean> {
  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, route_id, direction, payment_method, board_codes(code, valid_until)")
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

  const conductor = await signInActor(
    process.env.DEMO_CONDUCTOR_EMAIL,
    process.env.DEMO_CONDUCTOR_PASSWORD,
  );
  if (!conductor) return false;

  const { data: redeemed, error: redeemErr } = await conductor.rpc(
    "redeem_board_code",
    { p_route: live.route_id, p_direction: live.direction, p_code: code },
  );
  const outcome = (redeemed as { outcome?: string }[] | null)?.[0]?.outcome;
  if (redeemErr || outcome !== "success") return false;

  if (live.payment_method === "cash") {
    const { error: changeErr } = await conductor.rpc("record_change_credit", {
      p_ticket: live.id,
      p_note_cents: 200,
    });
    return !changeErr;
  }
  return true;
}

/** Rudo's simulated friend: the demo rider account parks $2 in escrow
 *  through the same send RPC any rider uses. Real ledger, labelled actor. */
async function friendSendsCredit(): Promise<boolean> {
  const friend = await signInActor(
    process.env.DEMO_RIDER_EMAIL,
    process.env.DEMO_RIDER_PASSWORD,
  );
  if (!friend) return false;
  const { error } = await friend.rpc("send_credit", { p_amount_cents: 200 });
  return !error;
}

/** The code reaches Rudo (simulated SMS): the friend's newest pending
 *  transfer code is claimed into the signed in persona's wallet. */
async function claimFriendCode(): Promise<boolean> {
  const friend = await signInActor(
    process.env.DEMO_RIDER_EMAIL,
    process.env.DEMO_RIDER_PASSWORD,
  );
  if (!friend) return false;
  const { data: transfers } = await friend
    .from("credit_transfers")
    .select("claim_code, created_at, transfer_events(event_type, created_at)")
    .order("created_at", { ascending: false })
    .limit(5);
  const pending = (transfers ?? []).find((tr) => {
    const events = (tr.transfer_events ?? []) as {
      event_type: string;
      created_at: string;
    }[];
    const latest = [...events].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    )[0];
    return latest?.event_type === "sent";
  });
  if (!pending?.claim_code) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_credit", {
    p_code: pending.claim_code,
  });
  const outcome = (data as { outcome: string }[] | null)?.[0]?.outcome;
  return !error && outcome === "success";
}

/** Shares the persona's newest boarded fare: the mother's view is the link. */
async function shareLatestRide(): Promise<boolean> {
  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("tickets")
    .select("id")
    .eq("kind", "fare")
    .order("purchased_at", { ascending: false })
    .limit(3);
  const { data: statuses } = await supabase
    .from("ticket_status")
    .select("ticket_id, status")
    .in("ticket_id", (tickets ?? []).map((t) => t.id));
  const statusOf = new Map(
    (statuses ?? []).map((s) => [s.ticket_id as string, s.status as string]),
  );
  const boarded = (tickets ?? []).find((t) => statusOf.get(t.id) === "redeemed");
  if (!boarded) return false;
  const { error } = await supabase.rpc("create_ride_share", {
    p_ticket: boarded.id,
  });
  return !error;
}
