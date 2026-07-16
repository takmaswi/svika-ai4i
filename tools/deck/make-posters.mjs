// Renders the WebGL kombi stage once per theme and saves the frames as the
// deck's no WebGL fallback posters (deck/assets/kombi-poster-night.webp and
// kombi-poster-day.webp). Rerun after any lighting or model change.
// Needs the deck server up: node serve.mjs

import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "../../apps/web/package.json"));
const { chromium } = require("@playwright/test");
const { default: sharp } = await import("sharp");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(6500); // entrance settled

async function poster(theme, color, out) {
  await page.evaluate(([t, c]) => {
    const k = window.SVK_ENGINE.ctx.kombi;
    k.setFloat(false);
    k.setTheme(t);
    k.setColor(c);
    document.body.classList.toggle("theme-day", t === "day");
    document.querySelectorAll(".scene.is-active, #rail, #hud-counter, #hud-hint, #btn-full")
      .forEach((el) => { el.style.visibility = "hidden"; });
  }, [theme, color]);
  await page.waitForTimeout(1200);
  const png = await page.screenshot({ timeout: 60000 });
  await sharp(png).webp({ quality: 82 }).toFile(out);
  console.log("wrote", out);
}

await poster("night", "white", "../../deck/assets/kombi-poster-night.webp");
await poster("day", "marigold", "../../deck/assets/kombi-poster-day.webp");
await browser.close();
