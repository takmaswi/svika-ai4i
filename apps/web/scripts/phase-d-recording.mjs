// Records the three vision scenes back to back in one take: Tinashe's crash
// flow stepped through its story, Gogo's mbudzi dialled and answered, and
// the capacity scene with its fleet badges. Headed Chromium, 360px, saved to
// docs/design-evidence/recordings/vision-scenes.webm.
//
// Usage: node scripts/phase-d-recording.mjs   (from apps/web, dev server on :3000)
import { chromium } from "@playwright/test";
import { mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const BASE = "http://localhost:3000";
const OUT = join(repoRoot, "docs", "design-evidence", "recordings");

async function next(page) {
  await page.getByTestId("story-next").click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_500);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    locale: "en-ZW",
    recordVideo: { dir: OUT, size: { width: 360, height: 740 } },
  });
  await context.addCookies([
    { name: "svika_theme", value: "light", url: BASE },
    { name: "svika_lang", value: "en", url: BASE },
  ]);
  const page = await context.newPage();

  // the shelf: where a judge finds the honesty split
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(4_000);
  await page.getByTestId("vision-door-tinashe").click();
  await page.waitForURL(/story=tinashe-crash&step=0/);
  await page.waitForTimeout(6_000);
  await next(page); // the mother's phone
  await next(page); // the responder view
  await next(page); // the closing caption
  await next(page); // done: back on the landing

  // Gogo: dial, menu, credit, then how far the kombi is
  await page.getByTestId("vision-door-gogo").click();
  await page.waitForURL(/story=gogo-ussd&step=0/);
  await page.waitForTimeout(2_500);
  for (const key of ["star", "1", "2", "3", "hash"]) {
    await page.getByTestId(`phone-key-${key}`).click();
    await page.waitForTimeout(350);
  }
  await page.getByTestId("phone-ok").click();
  await page.waitForTimeout(2_500);
  await page.getByTestId("phone-key-1").click();
  await page.getByTestId("phone-ok").click();
  await page.waitForTimeout(3_000);
  for (const key of ["star", "1", "2", "3", "hash"]) {
    await page.getByTestId(`phone-key-${key}`).click();
    await page.waitForTimeout(350);
  }
  await page.getByTestId("phone-ok").click();
  await page.waitForTimeout(2_000);
  await page.getByTestId("phone-key-3").click();
  await page.getByTestId("phone-ok").click();
  await page.waitForTimeout(4_000);

  // capacity: the fleet wearing declared numbers over the corridor
  await page.goto(`${BASE}/vision/capacity?story=kombi-capacity&step=0`);
  await page
    .getByTestId("capacity-badge")
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(8_000);
  await next(page); // the drift caption
  await page.waitForTimeout(3_000);

  const video = page.video();
  await context.close();
  const raw = await video.path();
  await browser.close();
  renameSync(raw, join(OUT, "vision-scenes.webm"));
  console.log("recording saved to docs/design-evidence/recordings/vision-scenes.webm");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
