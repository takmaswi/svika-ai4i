// Captures the Phase C evidence packs: the profile page and the share
// viewer at 360px, day and night, English and Shona, into
// docs/design-evidence/{profile,share}/. Headed Chromium (the MapLibre
// canvas paints blank in headless). Expects the dev server on :3000 with
// E2E_AUTH=on and the demo pool seeded.
//
// Usage: node scripts/phase-c-evidence.mjs   (from apps/web)
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
for (const f of [".env.local", ".env"]) {
  const p = join(repoRoot, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const BASE = "http://localhost:3000";
const OUT = join(repoRoot, "docs", "design-evidence");
const PERSONA_EMAIL = "demo.tariro.01@svika.app";

const bare = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );

// --- fixtures: rides, prefs, emergency details, one live share ------------
async function prepareFixtures() {
  const rider = bare();
  const { error: signErr } = await rider.auth.signInWithPassword({
    email: PERSONA_EMAIL,
    password: process.env.DEMO_JUDGE_PASSWORD,
  });
  if (signErr) throw new Error(`persona sign in failed: ${signErr.message}`);
  await rider.rpc("demo_reset_mine", { p_consent_version: "v1" });
  const uid = (await rider.auth.getUser()).data.user.id;

  await rider.from("rider_prefs").upsert(
    { rider_id: uid, commute_alerts: true, voice_en: true, voice_sn: false },
    { onConflict: "rider_id" },
  );
  await rider.rpc("save_emergency_details", {
    p_next_of_kin_name: "Amai Tariro",
    p_next_of_kin_phone: "+263 77 234 5678",
    p_medical_aid_name: "PSMAS",
    p_medical_aid_number: "PS 448812",
    p_consent_version: "emergency-v1",
  });

  const { data: route } = await rider
    .from("routes")
    .select("id")
    .eq("code", "HEIGHTS-REZENDE")
    .single();
  const { data: stops } = await rider
    .from("route_stops")
    .select("stop_id, seq")
    .eq("route_id", route.id)
    .eq("direction", "outbound")
    .order("seq");
  const first = stops[0].stop_id;
  const last = stops[stops.length - 1].stop_id;

  // a boarded fare to share, plus a second ride so the history reads warm
  const { data: bought, error: buyErr } = await rider.rpc("purchase_ticket", {
    p_route: route.id,
    p_direction: "outbound",
    p_from_stop: first,
    p_to_stop: last,
    p_payment: "wallet",
  });
  if (buyErr) throw new Error(`ticket failed: ${buyErr.message}`);

  const conductor = bare();
  const { error: condErr } = await conductor.auth.signInWithPassword({
    email: process.env.DEMO_CONDUCTOR_EMAIL,
    password: process.env.DEMO_CONDUCTOR_PASSWORD,
  });
  if (condErr) throw new Error(`conductor sign in failed: ${condErr.message}`);
  const { data: redeemed, error: redeemErr } = await conductor.rpc(
    "redeem_board_code",
    { p_route: route.id, p_direction: "outbound", p_code: bought[0].board_code },
  );
  if (redeemErr || redeemed[0]?.outcome !== "success") {
    throw new Error(`redeem failed: ${redeemErr?.message ?? redeemed[0]?.outcome}`);
  }

  const { data: share, error: shareErr } = await rider.rpc("create_ride_share", {
    p_ticket: bought[0].ticket_id,
  });
  if (shareErr) throw new Error(`share failed: ${shareErr.message}`);
  return { token: share[0].share_token };
}

const VARIANTS = [
  { theme: "light", lang: "en" },
  { theme: "light", lang: "sn" },
  { theme: "dark", lang: "en" },
  { theme: "dark", lang: "sn" },
];

async function settleMap(page) {
  await page
    .locator('[data-map-ready="true"]')
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(3_000);
}

async function shot(page, screen, variant) {
  const dir = join(OUT, screen);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: join(dir, `${variant.theme}-${variant.lang}.png`),
    fullPage: screen === "profile",
  });
  console.log(`${screen}/${variant.theme}-${variant.lang}.png`);
}

async function main() {
  const { token } = await prepareFixtures();
  const browser = await chromium.launch({ headless: false });

  for (const variant of VARIANTS) {
    const context = await browser.newContext({
      viewport: { width: 360, height: 740 },
      deviceScaleFactor: 2,
      locale: "en-ZW",
    });
    await context.addCookies([
      { name: "svika_theme", value: variant.theme, url: BASE },
      { name: "svika_lang", value: variant.lang, url: BASE },
    ]);
    const page = await context.newPage();

    const res = await page.request.post(`${BASE}/e2e/login`, {
      data: { email: PERSONA_EMAIL, password: process.env.DEMO_JUDGE_PASSWORD },
    });
    if (!res.ok()) throw new Error(`persona web login failed: ${res.status()}`);

    await page.goto(`${BASE}/app/profile`);
    await page.waitForTimeout(1_000);
    await shot(page, "profile", variant);

    // the viewer is anonymous: a clean context, same theme and language
    const viewerContext = await browser.newContext({
      viewport: { width: 360, height: 740 },
      deviceScaleFactor: 2,
      locale: "en-ZW",
    });
    await viewerContext.addCookies([
      { name: "svika_theme", value: variant.theme, url: BASE },
      { name: "svika_lang", value: variant.lang, url: BASE },
    ]);
    const viewer = await viewerContext.newPage();
    await viewer.goto(`${BASE}/share/${token}`);
    await settleMap(viewer);
    await shot(viewer, "share", variant);
    await viewerContext.close();

    await context.close();
  }

  await browser.close();
  console.log("phase C evidence written to docs/design-evidence");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
