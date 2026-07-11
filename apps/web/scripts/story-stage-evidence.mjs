// Captures the presentation stage packs: every step of every story at 360px
// and desktop width (caption never covering the screen is checked visually
// on these), a Shona pass per step at 360px, and the new intelligence
// surfaces (ladder page, provenance card, the three section shelf, the
// watchdog verdict card) at 360px, day and night, English and Shona.
// Headed Chromium (the MapLibre canvas paints blank in headless). Signed in
// stories enter through their real doors and drive the real engine, exactly
// like a judge; reruns are safe because entries reset persona state.
//
// Usage: node scripts/story-stage-evidence.mjs [--only <slug>|surfaces]
// (from apps/web, dev server on :3000)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const BASE = "http://localhost:3000";
const OUT = join(repoRoot, "docs", "design-evidence", "stage");

const DOORS = {
  "tariro-town": { testid: "story-door-town", steps: 6 },
  "transfer-trip": { testid: "story-door-transfer", steps: 3 },
  "takunda-morning": { testid: "story-door-takunda", steps: 4 },
  "rudo-night": { testid: "story-door-rudo", steps: 7 },
  "eta-knows": { testid: "story-door-eta", steps: 2 },
  "watchdog-leak": { testid: "story-door-watchdog", steps: 4 },
};
const VISIONS = {
  "tinashe-crash": { path: "/vision/tinashe?view=alert", steps: 4 },
  "gogo-ussd": { path: "/vision/gogo", steps: 2 },
  "kombi-capacity": { path: "/vision/capacity", steps: 2 },
};

const MOBILE = { width: 360, height: 740 };
const DESKTOP = { width: 1280, height: 800 };

async function settle(page) {
  await page
    .locator('[data-map-ready="true"]')
    .waitFor({ timeout: 20_000 })
    .catch(() => {});
  await page.waitForTimeout(1_500);
}

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

async function shootStep(page, slug, step, alsoDesktop = true) {
  const dir = join(OUT, slug);
  mkdirSync(dir, { recursive: true });
  await settle(page);
  await page.setViewportSize(MOBILE);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(dir, `step-${step}-360.png`) });
  if (alsoDesktop) {
    await page.setViewportSize(DESKTOP);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(dir, `step-${step}-1280.png`) });
    await page.setViewportSize(MOBILE);
    await page.waitForTimeout(200);
  }
  console.log(`${slug}/step-${step}`);
}

async function walkSignedInStory(browser, slug, door) {
  const context = await browser.newContext({ viewport: MOBILE, locale: "en-ZW" });
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByTestId(door.testid).click();
  await page.waitForURL(new RegExp(`story=${slug}&step=0`), { timeout: 30_000 });

  for (let step = 0; step < door.steps; step++) {
    await shootStep(page, slug, step);
    if (step < door.steps - 1) {
      await hydrated(page);
      await page.getByTestId("story-next").click();
      await page.waitForURL(new RegExp(`step=${step + 1}`), { timeout: 30_000 });
    }
  }

  // the Shona pass rides the same session: steps are addressable directly
  // and rendering never runs an action (the share step is skipped, its URL
  // is minted per run)
  await context.addCookies([{ name: "svika_lang", value: "sn", url: BASE }]);
  for (let step = 0; step < door.steps; step++) {
    if (slug === "rudo-night" && step === 6) continue;
    await page.goto(`${BASE}${stepPath(slug, step)}`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await settle(page);
    await page.screenshot({
      path: join(OUT, slug, `step-${step}-360-sn.png`),
    });
  }
  await context.close();
}

// step paths mirrored from src/lib/stories.ts (plain node cannot import the
// TypeScript module; keep in sync when stories change). The share sentinel
// step is skipped by its caller.
const STEP_PATHS = {
  "tariro-town": [
    "/app",
    "/app/plan?from=heights&to=rezende",
    "/app/plan?from=heights&to=rezende",
    "/app?booked=1",
    "/app?booked=1",
    "/app/wallet",
  ],
  "transfer-trip": [
    "/app/plan?from=heights&to=avondale",
    "/app/plan?from=heights&to=avondale",
    "/app?booked=1",
  ],
  "takunda-morning": ["/app", "/app?sheet=open", "/app?booked=1", "/app?voicedemo=1"],
  "rudo-night": [
    "/app?sheet=open",
    "/app/wallet",
    "/app/wallet",
    "/app/wallet",
    "/app?booked=1",
    "/app?booked=1",
    "/app",
  ],
  "eta-knows": ["/app", "/app/intelligence"],
  "watchdog-leak": ["/app/owner", "/app/owner", "/app/owner", "/app/owner"],
  "tinashe-crash": [
    "/vision/tinashe?view=alert",
    "/vision/tinashe?view=kin",
    "/vision/tinashe?view=responder",
    "/vision/tinashe?view=responder",
  ],
  "gogo-ussd": ["/vision/gogo", "/vision/gogo"],
  "kombi-capacity": ["/vision/capacity", "/vision/capacity"],
};

function stepPath(slug, step) {
  const path = STEP_PATHS[slug][step];
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}story=${slug}&step=${step}`;
}

async function walkVisionStory(browser, slug, steps) {
  const context = await browser.newContext({ viewport: MOBILE, locale: "en-ZW" });
  const page = await context.newPage();
  for (let step = 0; step < steps; step++) {
    await page.goto(`${BASE}${stepPath(slug, step)}`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await shootStep(page, slug, step);
  }
  await context.addCookies([{ name: "svika_lang", value: "sn", url: BASE }]);
  for (let step = 0; step < steps; step++) {
    await page.goto(`${BASE}${stepPath(slug, step)}`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await settle(page);
    await page.screenshot({ path: join(OUT, slug, `step-${step}-360-sn.png`) });
  }
  await context.close();
}

// the new intelligence surfaces, day and night, English and Shona
async function shootSurfaces(browser) {
  const variants = [
    { theme: "light", lang: "en" },
    { theme: "light", lang: "sn" },
    { theme: "dark", lang: "en" },
    { theme: "dark", lang: "sn" },
  ];
  for (const v of variants) {
    const context = await browser.newContext({ viewport: MOBILE, locale: "en-ZW" });
    await context.addCookies([
      { name: "svika_theme", value: v.theme, url: BASE },
      { name: "svika_lang", value: v.lang, url: BASE },
    ]);
    const page = await context.newPage();
    const dir = (name) => {
      const d = join(repoRoot, "docs", "design-evidence", name);
      mkdirSync(d, { recursive: true });
      return d;
    };

    // the three section shelf
    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
    await settle(page);
    await page.screenshot({
      path: join(dir("shelf"), `${v.theme}-${v.lang}.png`),
      fullPage: true,
    });

    // signed in surfaces ride the demo owner (watchdog card with verdicts)
    // and a pooled persona (ladder page, provenance card)
    await page.getByTestId("story-door-watchdog").click();
    await page.waitForURL(/story=watchdog-leak&step=0/, { timeout: 30_000 });
    await page.goto(`${BASE}/app/owner`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const wd = page.getByTestId("owner-watchdog");
    await wd.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(dir("owner-watchdog"), `${v.theme}-${v.lang}.png`),
    });

    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.getByTestId("demo-door").click();
    await page.waitForURL(/\/app$/, { timeout: 30_000 });
    await page.goto(`${BASE}/app/intelligence`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: join(dir("intelligence"), `${v.theme}-${v.lang}.png`),
      fullPage: true,
    });

    await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await hydrated(page);
    await page.getByTestId("eta-basis").first().click();
    await page.getByTestId("eta-basis-card").waitFor({ timeout: 10_000 });
    await page.screenshot({
      path: join(dir("eta-provenance"), `${v.theme}-${v.lang}.png`),
    });

    await context.close();
    console.log(`surfaces ${v.theme}-${v.lang}`);
  }
}

async function main() {
  const onlyIdx = process.argv.indexOf("--only");
  const only = onlyIdx === -1 ? null : process.argv[onlyIdx + 1];
  // warm the dev server so no shot races a first compile
  for (const path of ["/", "/vision/gogo", "/vision/tinashe", "/vision/capacity"]) {
    await fetch(`${BASE}${path}`).catch(() => {});
  }
  const browser = await chromium.launch({ headless: false });
  for (const [slug, door] of Object.entries(DOORS)) {
    if (only && only !== slug) continue;
    await walkSignedInStory(browser, slug, door);
  }
  for (const [slug, v] of Object.entries(VISIONS)) {
    if (only && only !== slug) continue;
    await walkVisionStory(browser, slug, v.steps);
  }
  if (!only || only === "surfaces") await shootSurfaces(browser);
  await browser.close();
  console.log("stage evidence written to docs/design-evidence");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
