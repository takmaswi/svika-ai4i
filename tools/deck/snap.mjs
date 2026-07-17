// Steps the running deck (http://localhost:4173) beat by beat with the
// keyboard, screenshotting every state into tools/deck/shots/. Used for the
// smoke pass, the gate evidence and the PDF frame export source.
// Usage: node snap.mjs [--query "?auto"] [--outdir shots] [--label run]

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "../../apps/web/package.json"));
const { chromium } = require("@playwright/test");

const args = process.argv.slice(2);
function opt(name, dflt) {
  const i = args.indexOf("--" + name);
  return i >= 0 ? args[i + 1] : dflt;
}
const QUERY = opt("query", "");
const OUTDIR = opt("outdir", "shots");
const LABEL = opt("label", "beat");
// 720p default: SwiftShader software WebGL cannot hold 1080p screenshots.
const VIEW = opt("viewport", "1280x720").split("x").map(Number);

// Beats per scene, engine order (26 total). Advancing past scene 1's first
// beat runs the swirl handoff, which navigates to scene 2 by itself: the
// rig treats scene 1 as one pressed beat and lets the handoff land.
const BEATS = { 1: 2, 2: 2, 3: 4, 4: 3, 5: 2, 6: 3, 7: 3, 8: 2, 9: 2, 10: 3 };

mkdirSync(OUTDIR, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: VIEW[0], height: VIEW[1] } });
page.on("console", (m) => { if (m.type() === "error") console.log("console error:", m.text()); });
page.on("pageerror", (e) => console.log("page error:", e.message));

await page.goto("http://localhost:4173/" + QUERY, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);

let shot = 0;
for (let scene = 1; scene <= 10; scene++) {
  for (let beat = 0; beat < BEATS[scene]; beat++) {
    // No press on the very first state, and none entering scene 2: the
    // swirl handoff (scene 1, beat 1) navigates there by itself, so its
    // settled end state IS scene 2's entrance.
    if (!(scene === 1 && beat === 0) && !(scene === 2 && beat === 0)) {
      // The engine now settles a still-running beat on the first press
      // (manual driving feel); the rig must wait for the beat to finish so
      // a press always *advances* and frame labels stay deterministic.
      await page
        .waitForFunction(() => !window.SVK_ENGINE?.beatActive?.(), null, { timeout: 12000 })
        .catch(() => {});
      await page.keyboard.press("Space");
    }
    await page.waitForTimeout(scene === 1 && beat === 0 ? 4200 : 3200);
    shot++;
    await page.screenshot({
      path: join(OUTDIR, `${LABEL}-s${String(scene).padStart(2, "0")}-b${beat}.png`),
      timeout: 60000,
    });
    console.log(`s${scene} b${beat} captured`);
  }
}

const fps = await page.evaluate(() => window.SVK_ENGINE?.ctx?.kombi?.fps?.() ?? -1);
console.log("kombi fps sample (last scene shown):", fps);

await browser.close();
console.log(`done: ${shot} frames in ${OUTDIR}/`);
