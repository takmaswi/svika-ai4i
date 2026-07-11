// Captures the Phase D vision scene packs: the sandbox shelf, Tinashe's
// three views, Gogo's mbudzi (mid session, menu on screen), and the capacity
// scene, at 360px, day and night, English and Shona, into
// docs/design-evidence/vision-*/. Headed Chromium (the MapLibre canvas
// paints blank in headless). Public pages: no login, no fixtures, no writes.
//
// Usage: node scripts/phase-d-evidence.mjs   (from apps/web, dev server on :3000)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const BASE = "http://localhost:3000";
const OUT = join(repoRoot, "docs", "design-evidence");

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
  await page.waitForTimeout(4_000);
}

async function shot(page, screen, variant, fullPage = false) {
  const dir = join(OUT, screen);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: join(dir, `${variant.theme}-${variant.lang}.png`),
    fullPage,
  });
  console.log(`${screen}/${variant.theme}-${variant.lang}.png`);
}

async function dialIntoMenu(page) {
  for (const key of ["star", "1", "2", "3", "hash"]) {
    await page.getByTestId(`phone-key-${key}`).click();
  }
  await page.getByTestId("phone-ok").click();
  await page.getByTestId("phone-screen").getByText("Svika").waitFor();
}

async function main() {
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

    // the sandbox shelf: the landing's honesty split, full page
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await settleMap(page);
    await shot(page, "shelf", variant, true);

    // Tinashe: the alert on the map, the mother's phone, the responder view
    await page.goto(`${BASE}/vision/tinashe?view=alert&story=tinashe-crash&step=0`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await settleMap(page);
    await shot(page, "vision-tinashe", variant);
    await page.goto(`${BASE}/vision/tinashe?view=kin&story=tinashe-crash&step=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1_000);
    await shot(page, "vision-tinashe-kin", variant);
    await page.goto(
      `${BASE}/vision/tinashe?view=responder&story=tinashe-crash&step=2`,
      { waitUntil: "domcontentloaded", timeout: 60_000 },
    );
    await page.waitForTimeout(1_000);
    await shot(page, "vision-tinashe-responder", variant);

    // Gogo: mid session, the menu answered on the mbudzi screen
    await page.goto(`${BASE}/vision/gogo?story=gogo-ussd&step=0`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1_000);
    await dialIntoMenu(page);
    await shot(page, "vision-gogo", variant, true);

    // capacity: badges riding the fleet plus the declared/proven card
    await page.goto(`${BASE}/vision/capacity?story=kombi-capacity&step=0`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await settleMap(page);
    await page
      .getByTestId("capacity-badge")
      .first()
      .waitFor({ timeout: 30_000 })
      .catch(() => {});
    await shot(page, "vision-capacity", variant);

    await context.close();
  }

  await browser.close();
  console.log("phase D evidence written to docs/design-evidence");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
