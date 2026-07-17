// Diagnostic: logs every real audio start (buffer source .start call) with
// its timestamp, scene, duration and context state during an ?auto run.
//   node audio-log.mjs [seconds=45]

import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "../../apps/web/package.json"));
const { chromium } = require("@playwright/test");

const SECONDS = Number(process.argv[2] || 45);
const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("console", (m) => {
  if (m.text().startsWith("[AUD]")) console.log(m.text());
});

await page.addInitScript(() => {
  const origStart = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) {
    const scene = window.SVK_ENGINE ? window.SVK_ENGINE.current : "?";
    console.log(
      `[AUD] t=${(performance.now() / 1000).toFixed(2)}s scene=${scene}` +
      ` dur=${this.buffer ? this.buffer.duration.toFixed(1) : "?"}s state=${this.context.state}`,
    );
    return origStart.apply(this, a);
  };
  const origResume = AudioContext.prototype.resume;
  AudioContext.prototype.resume = function () {
    console.log(`[AUD] t=${(performance.now() / 1000).toFixed(2)}s resume() state=${this.state}`);
    return origResume.apply(this);
  };
});

await page.goto("http://localhost:4173/?auto", { waitUntil: "networkidle" });
console.log("[AUD] --- page loaded, context state: " +
  (await page.evaluate(() => (window.SVK_AUDIO ? "api-present" : "api-missing"))));
await page.waitForTimeout(SECONDS * 1000);
await browser.close();
