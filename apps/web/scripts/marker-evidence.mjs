// Captures the kombi marker evidence: the map home at 360px day and night
// plus a close-up crop of a live marker, proving the glyph inside the
// DESIGN.md section 10 box is the client's kombi asset (packages/ui/assets/
// kombi-marker.svg), not the reference screens' placeholder glyph.
// Headed Chromium: the MapLibre WebGL canvas paints blank in headless.
//
// Usage: node scripts/marker-evidence.mjs   (from apps/web, dev server on :3000)
import { chromium } from "@playwright/test";
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
const OUT = join(repoRoot, "docs", "design-evidence", "marker");
const PERSONA_EMAIL = "demo.tariro.01@svika.app";

async function settleMap(page) {
  await page
    .locator('[data-map-ready="true"]')
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(3_000);
}

async function capture(browser, theme) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 3,
    locale: "en-ZW",
  });
  await context.addCookies([
    { name: "svika_theme", value: theme, url: BASE },
    { name: "svika_lang", value: "en", url: BASE },
  ]);
  const page = await context.newPage();

  const res = await page.request.post(`${BASE}/e2e/login`, {
    data: { email: PERSONA_EMAIL, password: process.env.DEMO_JUDGE_PASSWORD },
  });
  if (!res.ok()) throw new Error(`persona web login failed: ${res.status()}`);

  await page.goto(`${BASE}/app`);
  await settleMap(page);

  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: join(OUT, `home-${theme}-en.png`) });
  console.log(`marker/home-${theme}-en.png`);

  // close-up: a 130px CSS square centred on the first marker that sits
  // clear of the top chips and the bottom sheet
  const markers = page.locator('[data-testid="kombi-marker"]');
  const count = await markers.count();
  let box = null;
  for (let i = 0; i < count; i += 1) {
    const b = await markers.nth(i).boundingBox();
    if (b && b.y > 120 && b.y < 480) {
      box = b;
      break;
    }
  }
  if (!box) box = await markers.first().boundingBox();
  if (!box) throw new Error("no kombi marker on screen");
  const half = 65;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.screenshot({
    path: join(OUT, `closeup-${theme}.png`),
    clip: {
      x: Math.max(0, cx - half),
      y: Math.max(0, cy - half),
      width: half * 2,
      height: half * 2,
    },
  });
  console.log(`marker/closeup-${theme}.png`);
  await context.close();
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  await capture(browser, "light");
  await capture(browser, "dark");
  await browser.close();
  console.log("marker evidence written to docs/design-evidence/marker");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
