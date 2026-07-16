// Captures title reveals mid flight so the descender fix is provable:
// g, y, p must be visible inside the line mask while words are still
// rising. The global animation clock runs at 8 percent so software
// rendering can be screenshotted mid rise deterministically.
//   node descender-snap.mjs   (server must be up)

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "../../apps/web/package.json"));
const { chromium } = require("@playwright/test");

const OUT = "shots-descenders";
mkdirSync(OUT, { recursive: true });

const SCALE = 0.08;
// revealStart = the titleReveal delay inside the scene's first beat;
// the capture lands ~45 percent into the 0.9s word rise.
const ALL_CASES = [
  { hash: "s2-founding-ride", revealStart: 0, name: "s2-given-address" },
  { hash: "s4-take-me-there", revealStart: 0, name: "s4-type-any-place" },
  { hash: "s8-kombis-employed", revealStart: 0, name: "s8-company-car" },
  { hash: "s10-close", revealStart: 0.7, name: "s10-already-boarding" },
];
// node descender-snap.mjs [s2,s8,...]  (default: all four)
const pick = process.argv[2];
const CASES = pick
  ? ALL_CASES.filter((c) => pick.split(",").some((p) => c.hash.startsWith(p + "-")))
  : ALL_CASES;
const MID_ONLY = process.argv.includes("--mid-only");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(`{
  const t = setInterval(() => {
    if (window.gsap) { window.gsap.globalTimeline.timeScale(${SCALE}); clearInterval(t); }
  }, 10);
}`);

for (const c of CASES) {
  await page.goto("http://localhost:4173/?nowebgl&nolag#" + c.hash, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  const midMs = ((c.revealStart + 0.45) / SCALE) * 1000;
  await page.waitForTimeout(midMs);
  await page.screenshot({ path: join(OUT, `mid-${c.name}.png`), timeout: 90000 });
  if (!MID_ONLY) {
    await page.evaluate(() => window.gsap.globalTimeline.timeScale(1));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(OUT, `settled-${c.name}.png`), timeout: 90000 });
    await page.evaluate((s) => window.gsap.globalTimeline.timeScale(s), SCALE);
  }
  console.log(c.name, "captured" + (MID_ONLY ? " (mid)" : " (mid + settled)"));
}

await browser.close();
console.log("done:", OUT + "/");
