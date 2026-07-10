// Captures the design evidence packs: each raised screen at 360px, day and
// night, English and Shona, into docs/design-evidence/<screen>/. Runs a
// headed Chromium because the MapLibre WebGL canvas paints blank in headless
// capture. Expects the dev server from the e2e config on :3000 (E2E_AUTH=on
// for the owner sign in) and the demo pool seeded.
//
// Usage: node scripts/design-evidence.mjs   (from apps/web)
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

// --- fixture data: one issued ticket, one change credit, one parcel --------
async function prepareFixtures() {
  const rider = bare();
  const { error: signErr } = await rider.auth.signInWithPassword({
    email: PERSONA_EMAIL,
    password: process.env.DEMO_JUDGE_PASSWORD,
  });
  if (signErr) throw new Error(`persona sign in failed: ${signErr.message}`);
  await rider.rpc("demo_reset_mine", { p_consent_version: "v1" });

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

  // the change story: a cash fare cleared by the hwindi with a $2 note
  const { data: cashTicket, error: cashErr } = await rider.rpc("purchase_ticket", {
    p_route: route.id,
    p_direction: "outbound",
    p_from_stop: first,
    p_to_stop: last,
    p_payment: "cash",
  });
  if (cashErr) throw new Error(`cash ticket failed: ${cashErr.message}`);
  const cashRow = cashTicket[0];

  const conductor = bare();
  const { error: condErr } = await conductor.auth.signInWithPassword({
    email: process.env.DEMO_CONDUCTOR_EMAIL,
    password: process.env.DEMO_CONDUCTOR_PASSWORD,
  });
  if (condErr) throw new Error(`conductor sign in failed: ${condErr.message}`);
  const { data: redeemed, error: redeemErr } = await conductor.rpc(
    "redeem_board_code",
    { p_route: route.id, p_direction: "outbound", p_code: cashRow.board_code },
  );
  if (redeemErr || redeemed[0]?.outcome !== "success") {
    throw new Error(`redeem failed: ${redeemErr?.message ?? redeemed[0]?.outcome}`);
  }
  await conductor.rpc("record_change_credit", {
    p_ticket: cashRow.ticket_id,
    p_note_cents: 200,
  });

  // a live wallet ticket for the boarding card
  const { data: liveTicket, error: liveErr } = await rider.rpc("purchase_ticket", {
    p_route: route.id,
    p_direction: "outbound",
    p_from_stop: first,
    p_to_stop: last,
    p_payment: "wallet",
  });
  if (liveErr) throw new Error(`wallet ticket failed: ${liveErr.message}`);

  // a parcel with staged LOAD and COLLECT codes
  const { error: parcelErr } = await rider.rpc("purchase_parcel", {
    p_route: route.id,
    p_direction: "outbound",
    p_from_stop: first,
    p_to_stop: last,
    p_payment: "wallet",
  });
  if (parcelErr) throw new Error(`parcel failed: ${parcelErr.message}`);

  return {
    stampedTicketId: cashRow.ticket_id,
    liveTicketId: liveTicket[0].ticket_id,
  };
}

// --- capture ----------------------------------------------------------------
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
  await page.waitForTimeout(3_000); // let tiles and glyphs finish painting
}

async function shot(page, screen, variant) {
  const dir = join(OUT, screen);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: join(dir, `${variant.theme}-${variant.lang}.png`),
  });
  console.log(`${screen}/${variant.theme}-${variant.lang}.png`);
}

async function main() {
  const fixtures = await prepareFixtures();
  const browser = await chromium.launch({ headless: false });

  for (const variant of VARIANTS) {
    const context = await browser.newContext({
      viewport: { width: 360, height: 740 },
      deviceScaleFactor: 2,
      locale: "en-ZW",
    });
    const cookies = [
      { name: "svika_theme", value: variant.theme, url: BASE },
      { name: "svika_lang", value: variant.lang, url: BASE },
    ];
    await context.addCookies(cookies);
    const page = await context.newPage();

    // landing (public)
    await page.goto(`${BASE}/`);
    await settleMap(page);
    await shot(page, "landing", variant);

    // rider surfaces as the persona (sign in via the e2e endpoint; the demo
    // door would re-reset the fixtures prepared above)
    const res = await page.request.post(`${BASE}/e2e/login`, {
      data: {
        email: PERSONA_EMAIL,
        password: process.env.DEMO_JUDGE_PASSWORD,
      },
    });
    if (!res.ok()) throw new Error(`persona web login failed: ${res.status()}`);

    await page.goto(`${BASE}/app`);
    await settleMap(page);
    await shot(page, "home", variant);

    await page.goto(`${BASE}/app/plan?from=heights&to=avondale`);
    await settleMap(page);
    await shot(page, "plan", variant);

    await page.goto(`${BASE}/app/ticket/${fixtures.liveTicketId}`);
    await page.waitForTimeout(800);
    await shot(page, "ticket", variant);

    // the stamp moment, once per variant set, keeps its own file name
    if (variant.theme === "light" && variant.lang === "en") {
      await page.goto(`${BASE}/app/ticket/${fixtures.stampedTicketId}`);
      await page.waitForTimeout(900);
      const dir = join(OUT, "ticket");
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: join(dir, "stamped-light-en.png") });
      console.log("ticket/stamped-light-en.png");
    }

    await page.goto(`${BASE}/app/wallet`);
    await page.waitForTimeout(800);
    await shot(page, "wallet", variant);

    await page.goto(`${BASE}/app/parcel`);
    await page.waitForTimeout(800);
    await shot(page, "parcel", variant);

    // owner surfaces
    const ownerRes = await page.request.post(`${BASE}/e2e/login`, {
      data: {
        email: process.env.DEMO_OWNER_EMAIL,
        password: process.env.DEMO_OWNER_PASSWORD,
      },
    });
    if (!ownerRes.ok()) throw new Error(`owner login failed: ${ownerRes.status()}`);
    await page.goto(`${BASE}/app/owner`);
    await page.waitForTimeout(1_200);
    await shot(page, "owner", variant);

    // conductor keypad (separate Vite app; themes ride prefers-color-scheme)
    const hwindiContext = await browser.newContext({
      viewport: { width: 360, height: 740 },
      deviceScaleFactor: 2,
      colorScheme: variant.theme === "dark" ? "dark" : "light",
    });
    const hwindi = await hwindiContext.newPage();
    await hwindi.goto("http://localhost:5173/");
    await hwindi.waitForTimeout(800);
    // the in-app language pill drives EN/SN
    await hwindi
      .locator(".lang-toggle button", { hasText: variant.lang.toUpperCase() })
      .click()
      .catch(() => {});
    const emailBox = hwindi.locator("#email");
    if (await emailBox.count()) {
      await emailBox.fill(process.env.DEMO_CONDUCTOR_EMAIL);
      await hwindi.locator("#password").fill(process.env.DEMO_CONDUCTOR_PASSWORD);
      await hwindi.locator(".hwindi-cta").click();
    }
    await hwindi
      .locator(".hwindi-route", { hasText: "HEIGHTS-REZENDE" })
      .first()
      .click({ timeout: 20_000 })
      .catch(() => {});
    await hwindi.waitForTimeout(600);
    for (const d of ["7", "4"]) {
      await hwindi.locator(".hwindi-key", { hasText: d }).first().click().catch(() => {});
    }
    await hwindi.waitForTimeout(400);
    await shot(hwindi, "keypad", variant);
    await hwindiContext.close();

    await context.close();
  }

  await browser.close();
  console.log("evidence pack written to docs/design-evidence");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
