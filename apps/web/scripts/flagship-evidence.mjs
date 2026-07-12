// Evidence for the two layer flagship (tino-town): the three simulated preview
// beats and the real wallet update, captured day and night, English and Shona,
// each from a full real walk so the final wallet shows the actual credit, not a
// direct navigation. One variant also records a short video of the whole run
// (preview beats then the real tail and the live wallet climbing to $5.50).
// Headed Chromium (the app's MapLibre canvas paints blank in headless).
//
// Usage: node scripts/flagship-evidence.mjs   (from apps/web, dev server on :3000)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const BASE = "http://localhost:3000";
const OUT = join(repoRoot, "docs", "design-evidence", "flagship");
const VIDEO_DIR = join(OUT, "recording");
const MOBILE = { width: 360, height: 740 };

const VARIANTS = [
  { theme: "light", lang: "en", record: true },
  { theme: "light", lang: "sn", record: false },
  { theme: "dark", lang: "en", record: false },
  { theme: "dark", lang: "sn", record: false },
];

// name each step by what it shows, mirrored from src/lib/stories.ts
const STEP_NAMES = [
  "0-preview-book",
  "1-preview-clear",
  "2-preview-wallet",
  "3-real-plan",
  "4-real-booked",
  "5-real-wallet",
];

async function hydrated(page) {
  const sheet = page.getByTestId("home-sheet");
  if (await sheet.count()) {
    await sheet
      .first()
      .evaluate(
        (el) =>
          new Promise((resolve) => {
            const tick = () =>
              el.dataset.hydrated === "true" ? resolve(null) : setTimeout(tick, 100);
            tick();
          }),
      )
      .catch(() => {});
  }
}

async function walk(browser, v) {
  mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext({
    viewport: MOBILE,
    locale: "en-ZW",
    ...(v.record ? { recordVideo: { dir: VIDEO_DIR, size: MOBILE } } : {}),
  });
  await context.addCookies([
    { name: "svika_theme", value: v.theme, url: BASE },
    { name: "svika_lang", value: v.lang, url: BASE },
  ]);
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByTestId("story-door-town").click();
  await page.waitForURL(/story=tino-town&step=0/, { timeout: 30_000 });

  const shot = (step) =>
    page.screenshot({
      path: join(OUT, `${v.theme}-${v.lang}-step-${STEP_NAMES[step]}.png`),
    });

  for (let step = 0; step < STEP_NAMES.length; step++) {
    // let the beat settle (the wallet count up finishes) or the real screen paint
    await page.waitForTimeout(step < 3 ? 900 : 1_400);
    await shot(step);
    if (step < STEP_NAMES.length - 1) {
      await hydrated(page);
      await page.getByTestId("story-next").click();
      await page.waitForURL(new RegExp(`step=${step + 1}`), { timeout: 30_000 });
    }
  }

  await context.close();
  console.log(`flagship ${v.theme}-${v.lang}${v.record ? " (recorded)" : ""}`);
}

async function main() {
  await fetch(`${BASE}/`).catch(() => {});
  const browser = await chromium.launch({ headless: false });
  for (const v of VARIANTS) await walk(browser, v);
  await browser.close();
  console.log(`flagship evidence written to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
