// Evidence for the two layer Rudo night ride (rudo-night): the four simulated
// preview beats (stolen wallet filling to $2, boarding, the hwindi clearing,
// the mother's live view opening) and the real tail (friend escrow, claim,
// booking, clear, share) ending on the real /share link, captured in the night
// theme in English and Shona from a full real walk. The English run also
// records a short video of the whole flow. Headed Chromium (the app's MapLibre
// canvas paints blank in headless).
//
// Usage: node scripts/rudo-evidence.mjs   (from apps/web, dev server on :3000)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const BASE = "http://localhost:3000";
const OUT = join(repoRoot, "docs", "design-evidence", "rudo-night");
const VIDEO_DIR = join(OUT, "recording");
const MOBILE = { width: 360, height: 740 };

// Rudo is a night story, so dark only; English also records the video.
const VARIANTS = [
  { theme: "dark", lang: "en", record: true },
  { theme: "dark", lang: "sn", record: false },
];

// name each step by what it shows, mirrored from src/lib/stories.ts
const STEP_NAMES = [
  "0-preview-wallet",
  "1-preview-board",
  "2-preview-clear",
  "3-preview-share",
  "4-real-friend",
  "5-real-claim",
  "6-real-book",
  "7-real-hwindi",
  "8-real-share",
  "9-real-mother",
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
  await page.getByTestId("story-door-rudo").click();
  await page.waitForURL(/story=rudo-night&step=0/, { timeout: 30_000 });

  const shot = (step) =>
    page.screenshot({
      path: join(OUT, `${v.theme}-${v.lang}-step-${STEP_NAMES[step]}.png`),
    });

  for (let step = 0; step < STEP_NAMES.length; step++) {
    // let a preview beat settle (the wallet count up finishes) or the real
    // screen fully paint on the slower tail (the booked home is heavy)
    await page.waitForTimeout(step < 4 ? 900 : 4_000);
    await shot(step);
    if (step < STEP_NAMES.length - 1) {
      await page
        .getByTestId("story-next")
        .waitFor({ state: "visible", timeout: 30_000 });
      await hydrated(page);
      await page.getByTestId("story-next").click();
      await page.waitForURL(new RegExp(`step=${step + 1}`), {
        timeout: 30_000,
        waitUntil: "commit",
      });
    }
  }

  await context.close();
  console.log(`rudo-night ${v.theme}-${v.lang}${v.record ? " (recorded)" : ""}`);
}

async function main() {
  await fetch(`${BASE}/`).catch(() => {});
  const browser = await chromium.launch({ headless: false });
  for (const v of VARIANTS) await walk(browser, v);
  await browser.close();
  console.log(`rudo-night evidence written to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
