// Evidence for the demo commute alert firing at a non-morning clock: enters
// the Takunda door and captures the home with the alert on screen, stamped
// with the current Harare (CAT) hour so the shot proves it was not the mined
// morning window. English and Shona, Takunda's light theme.
//
// Usage: node scripts/takunda-alert-evidence.mjs   (from apps/web, dev on :3000)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const BASE = "http://localhost:3000";
const OUT = join(repoRoot, "docs", "design-evidence", "commute-alert");
const MOBILE = { width: 360, height: 740 };

// stamp the file with the CAT hour so the evidence carries its own clock
const catHour = new Date(Date.now() + 2 * 60 * 60_000).getUTCHours();
const hh = String(catHour).padStart(2, "0");

async function walk(browser, lang) {
  mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext({ viewport: MOBILE, locale: "en-ZW" });
  await context.addCookies([
    { name: "svika_theme", value: "light", url: BASE },
    { name: "svika_lang", value: lang, url: BASE },
  ]);
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByTestId("story-door-takunda").click();
  await page.waitForURL(/story=takunda-morning&step=0/, { timeout: 30_000 });
  await page.getByTestId("commute-alert").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(600);
  await page.screenshot({
    path: join(OUT, `takunda-alert-${lang}-cat-${hh}00.png`),
  });
  console.log(`commute alert ${lang} at CAT ${hh}:00`);
  await context.close();
}

async function main() {
  await fetch(`${BASE}/`).catch(() => {});
  const browser = await chromium.launch({ headless: false });
  for (const lang of ["en", "sn"]) await walk(browser, lang);
  await browser.close();
  console.log(`commute alert evidence written to ${OUT} (CAT ${hh}:00)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
