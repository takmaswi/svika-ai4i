// Captures title reveals mid flight so the descender fix is provable:
// g, y, p must be visible inside the line mask while words are still rising.
//   node descender-snap.mjs   (server must be up)

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "../../apps/web/package.json"));
const { chromium } = require("@playwright/test");

const OUT = "shots-descenders";
mkdirSync(OUT, { recursive: true });

// Scenes whose titles carry descenders, with a capture moment inside the
// 0.9s word rise (plus SplitText's own start delay per scene).
const CASES = [
  { hash: "s2-founding-ride", at: 500, name: "s2-given-address" },
  { hash: "s4-take-me-there", at: 500, name: "s4-type-any-place" },
  { hash: "s8-kombis-employed", at: 500, name: "s8-company-car" },
  { hash: "s10-close", at: 1100, name: "s10-already-boarding" },
];

const browser = await chromium.launch({ args: ["--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

for (const c of CASES) {
  await page.goto("http://localhost:4173/?nolag#" + c.hash, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(c.at);
  // Freeze the whole animation clock: software rendering is too slow to
  // catch a 0.9s rise with a timed screenshot, so the frame is pinned.
  await page.evaluate(() => window.gsap.globalTimeline.pause());
  await page.screenshot({ path: join(OUT, `mid-${c.name}.png`), timeout: 60000 });
  await page.evaluate(() => window.gsap.globalTimeline.play());
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, `settled-${c.name}.png`), timeout: 60000 });
  console.log(c.name, "captured (mid + settled)");
}

await browser.close();
console.log("done:", OUT + "/");
