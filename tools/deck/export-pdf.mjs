// Insurance export: the settled final beat of each scene as a 10 page PDF
// (deck/deck-frames.pdf), for the day the demo machine dies and someone
// else's laptop must present. Needs the deck server up.
//   node export-pdf.mjs

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const require = createRequire(join(process.cwd(), "../../apps/web/package.json"));
const { chromium } = require("@playwright/test");

const FRAMES = resolve("pdf-frames");
mkdirSync(FRAMES, { recursive: true });

const BEATS = { 1: 3, 2: 2, 3: 4, 4: 3, 5: 2, 6: 3, 7: 3, 8: 2, 9: 2, 10: 3 };

// Headed pass on the real GPU: capture the settled last beat per scene.
const headed = await chromium.launch({ headless: false, args: ["--window-size=1600,900"] });
const page = await headed.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(5000);
for (let scene = 1; scene <= 10; scene++) {
  for (let beat = 0; beat < BEATS[scene]; beat++) {
    if (!(scene === 1 && beat === 0)) await page.keyboard.press("Space");
    await page.waitForTimeout(2600);
  }
  await page.screenshot({ path: join(FRAMES, `frame-${String(scene).padStart(2, "0")}.png`) });
  console.log("frame", scene);
}
await headed.close();

// Headless pass: print the frames to a 16:9 PDF.
const files = readdirSync(FRAMES).filter((f) => f.endsWith(".png")).sort();
const html = `<!doctype html><meta charset="utf-8"><style>
@page { size: 1600px 900px; margin: 0; }
body { margin: 0; }
img { display: block; width: 1600px; height: 900px; }
</style>${files.map((f) => `<img src="file:///${FRAMES.replace(/\\/g, "/")}/${f}">`).join("")}`;
writeFileSync(join(FRAMES, "frames.html"), html);

const headless = await chromium.launch();
const p2 = await headless.newPage();
await p2.goto("file:///" + FRAMES.replace(/\\/g, "/") + "/frames.html", { waitUntil: "networkidle" });
await p2.pdf({ path: "../../deck/deck-frames.pdf", width: "1600px", height: "900px", printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
await headless.close();
console.log("wrote deck/deck-frames.pdf");
