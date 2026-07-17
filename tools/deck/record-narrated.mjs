// Listening evidence: records one full ?auto loop WITH the tab's real audio
// (narration + SFX through the actual mixer) by letting the page capture
// itself via getDisplayMedia. Also counts requests leaving localhost during
// the run; the answer must be zero.
//   node record-narrated.mjs   (server must be up on 4173)
// Writes ../../docs/deck-evidence/deck-narrated-run.webm

import { createRequire } from "node:module";
import { writeFileSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "../../apps/web/package.json"));
const { chromium } = require("@playwright/test");

const OUT = join("..", "..", "docs", "deck-evidence", "deck-narrated-run.webm");

const browser = await chromium.launch({
  headless: false,
  args: [
    "--autoplay-policy=no-user-gesture-required",
    "--auto-accept-this-tab-capture",
    "--window-size=1280,760",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

let external = 0;
const externalUrls = [];
page.on("request", (req) => {
  const raw = req.url();
  // blob: and data: never touch the network; unwrap blob's inner origin.
  if (raw.startsWith("data:")) return;
  const u = new URL(raw.replace(/^blob:/, ""));
  if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
    external++;
    externalUrls.push(req.url());
  }
});

rmSync(OUT, { force: true });
let wrote = 0;
await page.exposeFunction("SVK_SAVE_CHUNK", (b64) => {
  appendFileSync(OUT, Buffer.from(b64, "base64"));
  wrote += b64.length;
});

await page.goto("http://localhost:4173/?auto", { waitUntil: "networkidle" });

// The page records itself: tab video + tab audio, the real mix.
await page.evaluate(async () => {
  // Processing off, or Chrome's auto gain control rides the levels and the
  // tape stops being evidence of the real mix.
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30 },
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    preferCurrentTab: true,
    selfBrowserSurface: "include",
  });
  const rec = new MediaRecorder(stream, {
    mimeType: "video/webm;codecs=vp8,opus",
    videoBitsPerSecond: 1_500_000,
  });
  window.SVK_REC = rec;
  window.SVK_REC_DONE = new Promise((resolve) => {
    rec.onstop = resolve;
  });
  rec.ondataavailable = async (e) => {
    if (!e.data.size) return;
    const buf = await e.data.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    await window.SVK_SAVE_CHUNK(btoa(bin));
  };
  rec.start(2000);
});

// Ride the autoplay loop: all ten scenes, wrap back past scene 1 so its
// opening line (which started before the recorder) is on tape complete.
const path = [];
await page.waitForFunction(
  () => {
    const cur = window.SVK_ENGINE.current;
    const seen = (window.SVK_SEEN = window.SVK_SEEN || []);
    if (seen[seen.length - 1] !== cur) seen.push(cur);
    // full loop: reached the close (9), wrapped to 0, then left 0 again
    const iNine = seen.indexOf(9);
    const iZero = iNine >= 0 ? seen.indexOf(0, iNine) : -1;
    return iZero >= 0 && seen.length > seen.indexOf(0, iNine) + 1;
  },
  null,
  { timeout: 360_000, polling: 500 },
);
const seen = await page.evaluate(() => window.SVK_SEEN);

await page.evaluate(async () => {
  window.SVK_REC.stop();
  await window.SVK_REC_DONE;
});
await page.waitForTimeout(1000); // let the last chunk flush through the binding

await browser.close();
console.log("scene path:", seen.join(" > "));
console.log("recording:", OUT, `(~${Math.round((wrote * 0.75) / 1024 / 1024)}MB)`);
console.log(`requests leaving localhost: ${external}` + (external ? " FAIL\n" + externalUrls.join("\n") : "  (PASS)"));
process.exit(external ? 1 : 0);
