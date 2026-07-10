// Records the four kombi fleet flowing on the live map: a headed Chromium
// (the WebGL canvas paints blank in headless capture) visits the rider home
// as a demo persona and records ~50 seconds of the map, then the recording
// lands in docs/map-evidence/recordings. Expects the dev server on :3000
// with E2E_AUTH=on and the demo pool seeded.
//
// Usage: node scripts/map-recording.mjs   (from apps/web)
import { chromium } from "@playwright/test";
import { readFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
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
const OUT_DIR = join(repoRoot, "docs", "map-evidence", "recordings");
const RECORD_MS = 50_000;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  // the physical window must be at least as tall as the emulated viewport
  // or the capture letterboxes grey below the fold
  const browser = await chromium.launch({
    headless: false,
    args: ["--window-size=420,920"],
  });
  // scale factor 1: a 2x page is taller than the physical screen in headed
  // mode and the capture letterboxes grey below the real viewport
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    locale: "en-ZW",
    recordVideo: { dir: OUT_DIR, size: { width: 360, height: 740 } },
  });
  const page = await context.newPage();

  const res = await page.request.post(`${BASE}/e2e/login`, {
    data: {
      email: "demo.tariro.01@svika.app",
      password: process.env.DEMO_JUDGE_PASSWORD,
    },
  });
  if (!res.ok()) throw new Error(`persona login failed: ${res.status()}`);

  await page.goto(`${BASE}/app`);
  await page
    .locator('[data-map-ready="true"]')
    .waitFor({ timeout: 30_000 });
  await page.waitForTimeout(RECORD_MS);

  const video = page.video();
  await context.close();
  const raw = await video.path();
  const target = join(OUT_DIR, "four-kombi-fleet.webm");
  renameSync(raw, target);
  await browser.close();
  console.log(`recording written: ${target}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
