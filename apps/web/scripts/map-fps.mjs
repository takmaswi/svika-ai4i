// Measures how the live map actually moves on a cheap phone stand in:
// headed Chromium (WebGL paints blank headless) at 4x CPU throttle via CDP,
// logged in as a demo persona on the rider home. Over a sample window it
// counts animation frames (FPS, worst frame gap) and traces one kombi
// marker's CSS transform to show whether positions land on whole pixels
// (snapping) or fractions (smooth), and how the heading steps.
//
// Usage: node scripts/map-fps.mjs [label]   (from apps/web, dev server on :3000)
import { chromium } from "@playwright/test";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
for (const f of [".env.local", ".env"]) {
  const p = join(repoRoot, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const BASE = "http://localhost:3000";
const OUT_DIR = join(repoRoot, "docs", "map-evidence");
const LABEL = process.argv[2] ?? "run";
const SAMPLE_MS = 20_000;
const THROTTLE = 4;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: false,
    args: ["--window-size=420,920"],
  });
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    locale: "en-ZW",
  });
  const page = await context.newPage();

  const res = await page.request.post(`${BASE}/e2e/login`, {
    data: {
      email: "demo.tariro.01@svika.app",
      password: process.env.DEMO_JUDGE_PASSWORD,
    },
  });
  if (!res.ok()) throw new Error(`persona login failed: ${res.status()}`);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });

  await page.goto(`${BASE}/app`);
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(3_000); // let entrance settle

  const stats = await page.evaluate(async (sampleMs) => {
    // trace every kombi and report the busiest one: a kombi genuinely
    // dwelling at a rank would otherwise make the run look frozen
    const markerEls = [
      ...document.querySelectorAll('[data-testid="kombi-marker"]'),
    ];
    const frames = [];
    const traces = markerEls.map(() => []);
    let last = performance.now();
    const t0 = last;
    await new Promise((resolve) => {
      const tick = () => {
        const now = performance.now();
        frames.push(now - last);
        last = now;
        markerEls.forEach((el, i) => {
          traces[i].push({ t: now - t0, transform: el.style.transform });
        });
        if (now - t0 < sampleMs) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

    // parse translate(xpx, ypx) and rotateZ(deg) out of a transform trace
    const analyse = (trace) => {
      const parsed = trace
        .map((s) => {
          const m = s.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
          const r = s.transform.match(/rotateZ\(([-\d.]+)deg\)/);
          return m
            ? {
                t: s.t,
                x: Number(m[1]),
                y: Number(m[2]),
                deg: r ? Number(r[1]) : null,
              }
            : null;
        })
        .filter(Boolean);
      const fractional = parsed.filter(
        (p) => !Number.isInteger(p.x) || !Number.isInteger(p.y),
      ).length;
      const moves = [];
      const headingJumps = [];
      let travelled = 0;
      for (let i = 1; i < parsed.length; i++) {
        const d = Math.hypot(
          parsed[i].x - parsed[i - 1].x,
          parsed[i].y - parsed[i - 1].y,
        );
        travelled += d;
        if (d > 0) moves.push(d);
        if (parsed[i].deg !== null && parsed[i - 1].deg !== null) {
          let dd = Math.abs(parsed[i].deg - parsed[i - 1].deg) % 360;
          if (dd > 180) dd = 360 - dd;
          if (dd > 0) headingJumps.push(dd);
        }
      }
      moves.sort((a, b) => a - b);
      return {
        markerSamples: parsed.length,
        fractionalPositions: fractional,
        travelledPx: travelled,
        positionMoves: moves.length,
        medianMovePx: moves[Math.floor(moves.length / 2)] ?? 0,
        maxMovePx: moves.length ? moves[moves.length - 1] : 0,
        maxHeadingStepDeg: headingJumps.length ? Math.max(...headingJumps) : 0,
      };
    };
    const perMarker = traces.map(analyse);
    const busiest = perMarker.reduce(
      (a, b) => (b.travelledPx > (a?.travelledPx ?? -1) ? b : a),
      null,
    );

    frames.shift(); // first delta measures setup, not a frame
    const total = frames.reduce((a, b) => a + b, 0);
    const sorted = [...frames].sort((a, b) => a - b);
    const pct = (p) => sorted[Math.floor(sorted.length * p)] ?? 0;
    return {
      frames: frames.length,
      seconds: total / 1000,
      fps: (frames.length / total) * 1000,
      frameMsP50: pct(0.5),
      frameMsP95: pct(0.95),
      frameMsMax: sorted[sorted.length - 1] ?? 0,
      markers: markerEls.length,
      busiestMarker: busiest,
      perMarker,
    };
  }, SAMPLE_MS);

  const report = {
    label: LABEL,
    at: new Date().toISOString(),
    cpuThrottle: THROTTLE,
    viewport: "360x740",
    sampleMs: SAMPLE_MS,
    ...stats,
  };
  const file = join(OUT_DIR, `fps-${LABEL}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`written: ${file}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
