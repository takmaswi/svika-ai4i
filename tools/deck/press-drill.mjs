// Input reliability drill for the settle-then-step model, against
// http://localhost:4173. Proves: a press during a running beat settles it
// (no dead press), a rapid second press is debounced (no double advance),
// a held key advances only once, and Enter after clicking a rail dot
// settles instead of jumping two. Exits 1 on any FAIL.
//   node press-drill.mjs

import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "../../apps/web/package.json"));
const { chromium } = require("@playwright/test");

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (detail ? "  (" + detail + ")" : ""));
}

const browser = await chromium.launch({ args: ["--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// nowebgl keeps the drill deterministic on software rendering and also
// exercises the fallback api path through the tracker.
await page.goto("http://localhost:4173/?nowebgl&nolag", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.SVK_ENGINE?.current === 0, null, { timeout: 15000 });

const idle = () =>
  page.waitForFunction(() => !window.SVK_ENGINE.beatActive(), null, { timeout: 15000 });
const engineState = () =>
  page.evaluate(() => ({ current: window.SVK_ENGINE.current, active: window.SVK_ENGINE.beatActive() }));

// 1 · Settle: a press during a running beat lands its end state, same scene.
await page.evaluate(() => window.SVK_ENGINE.go(1)); // scene 2, beat 0 runs ~3.4s
await page.waitForTimeout(400);
let s = await engineState();
check("beat runs on scene entry", s.current === 1 && s.active, JSON.stringify(s));
await page.keyboard.press("Space");
await page.waitForTimeout(120);
s = await engineState();
check("press during beat settles, does not advance", s.current === 1 && !s.active, JSON.stringify(s));
const titleShown = await page.evaluate(
  () => Number(getComputedStyle(document.querySelector("#s2-title")).opacity) === 1,
);
check("settle renders the beat's end state (title visible)", titleShown);

// 2 · Next press advances exactly one beat.
await page.waitForTimeout(300);
await page.keyboard.press("Space"); // consumes s2 beat 1 (the walk)
await page.waitForTimeout(120);
s = await engineState();
check("press after settle advances one beat", s.current === 1 && s.active, JSON.stringify(s));

// 3 · Debounce: two presses 40ms apart act once.
await idle();
await page.waitForTimeout(300);
await page.keyboard.press("Space"); // queue empty -> go(2)
await page.waitForTimeout(40);
await page.keyboard.press("Space"); // inside the 220ms window -> ignored
await page.waitForTimeout(200);
s = await engineState();
check("rapid double press advances once (debounced)", s.current === 2, JSON.stringify(s));

// 4 · Held key: auto-repeat keydowns are ignored.
await idle();
await page.waitForTimeout(300);
await page.evaluate(() => {
  for (let i = 0; i < 6; i++) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", repeat: true, bubbles: true }));
  }
});
await page.waitForTimeout(200);
const card2Hidden = await page.evaluate(
  () => Number(getComputedStyle(document.querySelector("#s3-card-change")).opacity) === 0,
);
s = await engineState();
check("held key repeats are ignored", s.current === 2 && card2Hidden, JSON.stringify(s));
await page.keyboard.press("Space"); // a real press still works
await idle();
const card2Shown = await page.evaluate(
  () => Number(getComputedStyle(document.querySelector("#s3-card-change")).opacity) === 1,
);
check("real press after held key still advances", card2Shown);

// 5 · Rail dot then Enter: settles the entry beat, never jumps two.
await page.waitForTimeout(300);
await page.locator("#rail button").nth(3).click(); // scene 4, typing beat runs
await page.waitForTimeout(300);
const focusCleared = await page.evaluate(() => document.activeElement.parentElement?.id !== "rail");
check("rail dot blurs after click", focusCleared);
await page.keyboard.press("Enter");
await page.waitForTimeout(120);
s = await engineState();
const typed = await page.evaluate(() => document.querySelector("#s4-typed").textContent);
check(
  "Enter after rail click settles, no double jump",
  s.current === 3 && !s.active && typed === "Westgate turn off",
  JSON.stringify(s) + " typed=" + JSON.stringify(typed),
);

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} FAILED` : "\nall input drills passed");
process.exit(failed ? 1 : 0);
