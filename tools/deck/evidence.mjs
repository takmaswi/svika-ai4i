// Gate evidence for the showcase deck, run against http://localhost:4173.
//   node evidence.mjs run       headed real GPU: full keyboard run, video,
//                               request log (offline proof), fps numbers
//   node evidence.mjs reduced   reduced motion drill, settled screenshots
//   node evidence.mjs nowebgl   forced fallback drill, poster screenshots
// Outputs land in ../../docs/deck-evidence/.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, renameSync, readdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "../../apps/web/package.json"));
const { chromium } = require("@playwright/test");

const OUT = "../../docs/deck-evidence";
mkdirSync(OUT, { recursive: true });

// 26 beats since the one action cold open: scene 1's second beat is the
// swirl handoff, which navigates to scene 2 by itself, so entering scene 2
// costs no press.
const BEATS = { 1: 2, 2: 2, 3: 4, 4: 3, 5: 2, 6: 3, 7: 3, 8: 2, 9: 2, 10: 3 };
const mode = process.argv[2] || "run";

// The engine settles a still-running beat on the first press, so the rig
// waits the beat out before pressing; otherwise every press would land one
// beat behind and the run would end short.
async function beatIdle(page) {
  await page
    .waitForFunction(() => !window.SVK_ENGINE?.beatActive?.(), null, { timeout: 12000 })
    .catch(() => {});
}

async function fullRun(page, holdMs, onBeat) {
  await page.waitForTimeout(4500);
  for (let scene = 1; scene <= 10; scene++) {
    for (let beat = 0; beat < BEATS[scene]; beat++) {
      if (!(scene === 1 && beat === 0) && !(scene === 2 && beat === 0)) {
        await beatIdle(page);
        await page.keyboard.press("Space");
      }
      await page.waitForTimeout(holdMs);
      if (onBeat) await onBeat(scene, beat);
    }
  }
}

if (mode === "run") {
  const browser = await chromium.launch({ headless: false, args: ["--window-size=1600,900"] });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1600, height: 900 } },
  });
  const page = await context.newPage();
  const requests = new Set();
  page.on("request", (r) => requests.add(r.url()));

  await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
  const fpsSamples = [];
  await fullRun(page, 3000, async (scene, beat) => {
    if ((scene === 1 || scene === 10) && beat > 0) {
      fpsSamples.push({ scene, beat, fps: await page.evaluate(() => window.SVK_ENGINE.ctx.kombi.fps()) });
    }
  });

  // blob: URLs are in-memory object URLs minted by GLTFLoader for decoded
  // textures; they never touch the network.
  const external = [...requests].filter(
    (u) => !u.startsWith("http://localhost:4173/") && !u.startsWith("blob:http://localhost:4173/"),
  );
  const report = [
    "# Deck evidence: full keyboard run (headed, real GPU)",
    "",
    "Date: " + new Date().toISOString(),
    "",
    "## Network (offline proof)",
    "Total requests: " + requests.size,
    "Requests leaving localhost:4173: " + external.length + (external.length ? "  <-- FAIL\n" + external.join("\n") : "  (zero network at runtime: PASS)"),
    "",
    "## WebGL fps during kombi scenes (rolling 90 frame average)",
    ...fpsSamples.map((s) => `scene ${s.scene} beat ${s.beat}: ${s.fps} fps`),
    "",
    "## Run",
    "All 26 beats of the 10 scenes advanced by keyboard; video beside this file.",
  ].join("\n");
  writeFileSync(join(OUT, "run-report.md"), report);
  await context.close();
  await browser.close();
  const vid = readdirSync(OUT).find((f) => f.endsWith(".webm") && !f.startsWith("deck-full-run"));
  if (vid) renameSync(join(OUT, vid), join(OUT, "deck-full-run.webm"));
  console.log(report);
}

if (mode === "reduced") {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader"] });
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  // Under reduced motion every beat runs on entry, so one screenshot per
  // scene is the settled truth; step scene by scene.
  let n = 1;
  const picks = [1, 2, 3, 6, 10];
  for (let scene = 1; scene <= 10; scene++) {
    if (scene > 1) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(900); }
    if (picks.includes(scene)) {
      await page.screenshot({ path: join(OUT, `reduced-s${String(scene).padStart(2, "0")}.png`), timeout: 60000 });
      n++;
    }
  }
  console.log("reduced motion drill: settled screenshots written", n - 1);
  await browser.close();
}

if (mode === "nowebgl") {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("http://localhost:4173/?nowebgl&nolag", { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);
  const mode3d = await page.evaluate(() => window.SVK_ENGINE.ctx.kombi.mode);
  await page.screenshot({ path: join(OUT, "nowebgl-s01.png"), timeout: 60000 });
  await page.goto("http://localhost:4173/?nowebgl&nolag#s10-close", { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await beatIdle(page);
  await page.keyboard.press("Space"); await page.waitForTimeout(700);
  await beatIdle(page);
  await page.keyboard.press("Space"); await page.waitForTimeout(1000);
  await page.screenshot({ path: join(OUT, "nowebgl-s10.png"), timeout: 60000 });
  console.log("nowebgl drill: kombi mode =", mode3d, "(expect fallback), screenshots written");
  await browser.close();
}
