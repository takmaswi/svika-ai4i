// Records the live map for the map excellence evidence pack: headed Chromium
// (WebGL paints blank headless) at 4x CPU throttle, demo persona on the rider
// home. One script, several shots:
//
//   node scripts/map-capture.mjs movement-before 25
//   node scripts/map-capture.mjs marker-closeup 15 --zoom=3
//   node scripts/map-capture.mjs camera-entry 12 --fresh
//   node scripts/map-capture.mjs camera-trip 15 --url=/app/plan?from=...&to=...
//
// label and seconds are positional; --zoom=N double clicks the first visible
// kombi N times so the marker fills the frame; --fresh records from page load
// (camera entrance); --url overrides the path; --theme=dark flips the theme.
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

const label = process.argv[2];
const seconds = Number(process.argv[3] ?? 20);
if (!label || Number.isNaN(seconds)) {
  console.error("usage: node scripts/map-capture.mjs <label> <seconds> [--zoom=N] [--fresh] [--url=/path] [--theme=dark]");
  process.exit(1);
}
const flags = process.argv.slice(4);
const flag = (name) => flags.find((f) => f.startsWith(`--${name}`));
const zoomClicks = Number(flag("zoom")?.split("=")[1] ?? 0);
const fresh = Boolean(flag("fresh"));
const url = flag("url")?.split("=").slice(1).join("=") ?? "/app";
const theme = flag("theme")?.split("=")[1] ?? "light";

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: false,
    args: ["--window-size=420,920"],
  });
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    locale: "en-ZW",
    recordVideo: { dir: OUT_DIR, size: { width: 360, height: 740 } },
  });
  await context.addCookies([
    { name: "svika_theme", value: theme, url: BASE },
    { name: "svika_lang", value: "en", url: BASE },
  ]);
  const page = await context.newPage();

  const res = await page.request.post(`${BASE}/e2e/login`, {
    data: {
      email: "demo.tariro.01@svika.app",
      password: process.env.DEMO_JUDGE_PASSWORD,
    },
  });
  if (!res.ok()) throw new Error(`persona login failed: ${res.status()}`);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  await page.goto(`${BASE}${url}`);
  if (!fresh) {
    await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2_000);
  }

  if (zoomClicks > 0) {
    await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 });
    const markers = page.locator('[data-testid="kombi-marker"]');
    let box = null;
    const count = await markers.count();
    for (let i = 0; i < count; i += 1) {
      const b = await markers.nth(i).boundingBox();
      if (b && b.y > 140 && b.y < 340) {
        box = b;
        break;
      }
    }
    if (!box) box = await markers.first().boundingBox();
    if (!box) throw new Error("no kombi marker on screen");
    // wheel zoom next to the marker: a dblclick on the marker element never
    // reaches the canvas, so the map would not zoom at all
    let cx = box.x + box.width / 2;
    let cy = box.y + box.height / 2;
    for (let i = 0; i < zoomClicks; i += 1) {
      await page.mouse.move(cx + 30, cy);
      await page.mouse.wheel(0, -1200);
      await page.waitForTimeout(1100);
      const b = await markers.first().boundingBox();
      if (b) {
        cx = b.x + b.width / 2;
        cy = b.y + b.height / 2;
      }
    }
  }

  await page.waitForTimeout(seconds * 1000);

  const video = page.video();
  await context.close();
  const raw = await video.path();
  const target = join(OUT_DIR, `${label}.webm`);
  renameSync(raw, target);
  await browser.close();
  console.log(`recording written: ${target}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
