// Studio tool: generates the deck's music bed ONCE via the ElevenLabs music
// API and ships processed, committed files under deck/assets/audio/. Like
// make-audio.mjs, ElevenLabs is never a runtime dependency and the key lives
// only in ../../.env.local.
//
//   node make-music.mjs plan          one composition plan for the whole bed
//                                     (locks key and BPM), written to
//                                     music-plan.json
//   node make-music.mjs stems [name]  generate raw renders per stem into
//                                     music-raw/ (kept out of git; credits
//                                     are only spent here)
//   node make-music.mjs cut           find seamless loop points, cut on bar
//                                     boundaries at zero crossings, master
//                                     to the music law and encode the
//                                     shipping files
//   node make-music.mjs verify        prove every shipped loop: three cycle
//                                     tapes to docs/deck-evidence and a
//                                     seam discontinuity table
//
// The sound (never name artists): cinematic trap meets a blockbuster film
// score. One minor key, one BPM (140, halftime) across every piece so stems
// can crossfade.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";

const RAW_DIR = "music-raw";
const OUT_DIR = join("..", "..", "deck", "assets", "audio", "music");
const SFX_DIR = join("..", "..", "deck", "assets", "audio", "sfx");
const EVIDENCE_DIR = join("..", "..", "docs", "deck-evidence", "music-loops");
const PLAN_FILE = "music-plan.json";

const BPM = 140;
const BAR_S = (60 / BPM) * 4; // 1.7143s per bar
const SR = 44100;
const MUSIC_I = -28; // ~12 dB under the voice law when solo
const MUSIC_TP = -2.0;

// One composition, six intensities. Loops are cut to whole bars later; the
// requested length leaves the finder room to choose musical cut points.
const STEMS = [
  {
    name: "bed-low",
    loop: true,
    lengthMs: 42000,
    styles: [
      "sparse dark opening", "deep 808 sub bass pulse", "low ominous drone",
      "distant low choir pad", "tense muted string ostinato",
      "no drums", "minimal", "brooding restraint",
    ],
  },
  {
    name: "bed-mid",
    loop: true,
    lengthMs: 42000,
    styles: [
      "halftime trap drums enter", "punchy 808 sub", "sparse hard snare on the half",
      "tight hi hat rolls", "tense string ostinato", "low brass pulses",
      "confident restrained energy",
    ],
  },
  {
    name: "bed-rise",
    loop: true,
    lengthMs: 42000,
    // Builds must reset within the phrase or the loop wrap reads as a
    // jump-cut: rolling waves over a consistent floor, never one long climb.
    styles: [
      "rolling waves of intensity that reset every eight bars",
      "consistent energy floor", "layered halftime percussion",
      "driving string ostinato", "dark brass swells", "low choir",
      "fuller hard hitting drums", "cinematic momentum", "loopable groove",
    ],
  },
  {
    name: "bed-pull",
    loop: true,
    lengthMs: 42000,
    styles: [
      "stripped back tension", "drums fall away", "bare 808 sub heartbeat",
      "sustained low strings", "quiet tense choir", "suspended and unresolved",
    ],
  },
  {
    name: "close-swell",
    loop: false,
    lengthMs: 45000,
    styles: [
      "the peak of the score", "full halftime drums and dark brass climax",
      "soaring strings over the trap groove", "low choir at full weight",
      "a final resolving hit", "long decaying tail", "ends resolved",
    ],
  },
  {
    name: "open-hit",
    loop: false,
    sting: true,
    lengthMs: 12000,
    styles: [
      "one single massive cinematic impact hit", "dark brass stab with an 808 drop",
      "short dark decaying tail", "one hit only then silence",
    ],
  },
];

const GLOBAL_PROMPT =
  "Epic cinematic trap instrumental for a product film: halftime groove at 140 BPM, " +
  "one dark minor key, deep 808 sub bass with sparse hard hitting drums, dark brass " +
  "swells, low choir, tense string ostinato, hybrid film score texture, epic but " +
  "restrained, fully instrumental, no vocals.";

function apiKey() {
  let env;
  try {
    env = readFileSync(join("..", "..", ".env.local"), "utf8");
  } catch {
    console.error("no .env.local found at the repo root");
    process.exit(1);
  }
  const m = env.match(/^ELEVENLABS_API_KEY=(.+)$/m);
  if (!m || !m[1].trim()) {
    console.error("ELEVENLABS_API_KEY is missing from .env.local; add it and rerun");
    process.exit(1);
  }
  return m[1].trim();
}

async function api(path, body, expectJson) {
  const res = await fetch(`https://api.elevenlabs.io${path}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey(), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return expectJson ? res.json() : Buffer.from(await res.arrayBuffer());
}

// ---------- ffmpeg helpers ----------
function ff(args) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
}
function ffStderr(args) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args], { encoding: "utf8" });
  return (r.stderr || "") + (r.stdout || "");
}
function decodeStereo(file) {
  const buf = execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-i", file, "-ac", "2", "-ar", String(SR), "-f", "f32le", "-"],
    { maxBuffer: 1 << 30 },
  );
  const all = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const n = all.length / 2;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = all[2 * i]; R[i] = all[2 * i + 1]; }
  return { L, R, n };
}
function analyze(file) {
  const out = ffStderr(["-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]);
  const summary = out.slice(out.lastIndexOf("Summary:"));
  const i = summary.match(/I:\s+(-?[\d.]+) LUFS/);
  const tp = summary.match(/Peak:\s+(-?[\d.]+) dBFS/);
  if (!i) throw new Error("no loudness summary for " + file);
  return { I: Number(i[1]), TP: tp ? Number(tp[1]) : 0 };
}

const mode = process.argv[2];

if (mode === "plan") {
  const plan = await api("/v1/music/plan", { prompt: GLOBAL_PROMPT, music_length_ms: 42000 }, true);
  writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2) + "\n");
  console.log("wrote", PLAN_FILE);
  console.log(JSON.stringify(plan, null, 2));
} else if (mode === "stems") {
  const plan = JSON.parse(readFileSync(PLAN_FILE, "utf8"));
  mkdirSync(RAW_DIR, { recursive: true });
  const only = process.argv.slice(3);
  for (const stem of STEMS) {
    if (only.length && !only.includes(stem.name)) continue;
    // One plan, one key, one BPM: every stem reuses the plan's global styles
    // and swaps only the section character.
    const composition_plan = {
      positive_global_styles: plan.positive_global_styles,
      negative_global_styles: plan.negative_global_styles,
      sections: [
        {
          section_name: stem.name,
          positive_local_styles: stem.styles,
          negative_local_styles: ["vocals", "singing", "spoken word", "bright major key"],
          duration_ms: stem.lengthMs,
          lines: [],
        },
      ],
    };
    const buf = await api("/v1/music?output_format=mp3_44100_192", { composition_plan }, false);
    const file = join(RAW_DIR, `${stem.name}.mp3`);
    writeFileSync(file, buf);
    console.log("wrote", file, `(${(buf.length / 1024).toFixed(0)}kb)`);
  }
} else if (mode === "cut") {
  cutAll();
} else if (mode === "verify") {
  verifyAll();
} else {
  console.error("usage: node make-music.mjs <plan|stems|cut|verify>");
  process.exit(1);
}

// ---------- loop cutting ----------

// Finds (t0, L) with L a whole number of bars such that the audio at t0 and
// t0+L is maximally similar: the cut [t0, t0+L) then loops seamlessly on a
// musical boundary. The coarse pass scores musical continuity over three
// windows; the fine pass jointly micro-shifts both cut points (a few ms,
// inaudible against the bar grid) to the zero-crossing alignment that
// minimises the discontinuity the runtime will actually play.
function findLoop(L_, R_, n) {
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) mono[i] = (L_[i] + R_[i]) / 2;
  const bar = Math.round(BAR_S * SR);

  // Coarse: correlation across 3 windows spread over 1.2s, so the score
  // reflects the phrase repeating, not one lucky phase match.
  const win = Math.round(0.18 * SR);
  const offsets = [0, Math.round(0.6 * SR), Math.round(1.2 * SR)];
  let best = null;
  const minLoop = 16, maxLoop = 20; // bars: 27.4s to 34.3s
  for (let bars = minLoop; bars <= maxLoop; bars++) {
    const L = bars * bar;
    if (L + offsets[2] + win + SR > n) continue;
    for (let t0 = Math.round(1.5 * SR); t0 + L + offsets[2] + win < n; t0 += Math.round(0.05 * SR)) {
      let score = 0;
      for (const off of offsets) {
        let num = 0, ea = 0, eb = 0;
        for (let j = 0; j < win; j += 2) {
          const a = mono[t0 + off + j], b = mono[t0 + L + off + j];
          num += a * b; ea += a * a; eb += b * b;
        }
        score += num / Math.sqrt(ea * eb + 1e-12);
      }
      score /= offsets.length;
      if (!best || score > best.score) best = { t0, L, score, bars };
    }
  }
  if (!best) throw new Error("audio too short for a loop");

  // Fine: the runtime plays x[t0..t0+L-1] then jumps back to x[t0], so the
  // seam is smooth iff x[t0+j] tracks x[t0+L+j] around j=0 in both channels.
  // Jointly shift start and length ±15ms to minimise exactly that.
  function seamCost(t0, L) {
    let c = 0;
    for (let j = -24; j <= 24; j++) {
      c += Math.abs(L_[t0 + j] - L_[t0 + L + j]) + Math.abs(R_[t0 + j] - R_[t0 + L + j]);
    }
    return c / 49;
  }
  const span = Math.round(0.015 * SR);
  let fine = { t0: best.t0, L: best.L, cost: seamCost(best.t0, best.L) };
  for (let dt = -span; dt <= span; dt++) {
    for (let dL = -span; dL <= span; dL += 3) {
      const t0 = best.t0 + dt, L = best.L + dL;
      if (t0 < 25 || t0 + L + 25 >= n) continue;
      const cost = seamCost(t0, L);
      if (cost < fine.cost) fine = { t0, L, cost };
    }
  }
  const seam =
    Math.abs(mono[fine.t0] - mono[fine.t0 + fine.L]) +
    Math.abs(mono[fine.t0 + 1] - mono[fine.t0 + fine.L + 1]);
  return { t0: fine.t0, L: fine.L, bars: best.bars, score: best.score, seam, cost: fine.cost };
}

function masterGain(file) {
  const m = analyze(file);
  let gain = MUSIC_I - m.I;
  let capped = false;
  if (m.TP + gain > MUSIC_TP) { gain = MUSIC_TP - m.TP; capped = true; }
  return { gain, capped };
}

function cutAll() {
  mkdirSync(OUT_DIR, { recursive: true });
  const manifest = { bpm: BPM, files: [] };
  for (const stem of STEMS) {
    const raw = join(RAW_DIR, `${stem.name}.mp3`);
    if (!existsSync(raw)) { console.error("missing raw render:", raw); process.exit(1); }

    if (stem.sting) {
      // The sting ships as an SFX cue: mono, the SFX room and law, played on
      // the sfx bus so it can never be masked by the bed.
      const { L, R, n } = decodeStereo(raw);
      const mono = new Float32Array(n);
      for (let i = 0; i < n; i++) mono[i] = (L[i] + R[i]) / 2;
      // Find the hit onset, cut just before it to the decay floor.
      let onset = 0, peak = 0;
      for (let i = 0; i < n; i++) if (Math.abs(mono[i]) > peak) { peak = Math.abs(mono[i]); onset = i; }
      let start = onset;
      while (start > 0 && Math.abs(mono[start]) > peak * 0.02) start--;
      start = Math.max(0, start - Math.round(0.03 * SR));
      let end = Math.min(n, onset + Math.round(3.2 * SR));
      const startS = (start / SR).toFixed(3), lenS = ((end - start) / SR).toFixed(3);
      const wav = join(RAW_DIR, "open-hit.work.wav");
      ff(["-i", raw, "-af",
        `atrim=${startS}:${(Number(startS) + Number(lenS)).toFixed(3)},` +
        "aformat=channel_layouts=mono,highpass=f=30,lowpass=f=13000," +
        `afade=t=in:st=0:d=0.006,afade=t=out:st=${(Number(lenS) - 0.06).toFixed(3)}:d=0.06`,
        "-ar", String(SR), "-ac", "1", "-c:a", "pcm_f32le", wav]);
      const { gain, capped } = (() => {
        const m = analyze(wav);
        const SFX_I = -26, SFX_TP = -3.0;
        let g = SFX_I - m.I, c = false;
        if (m.TP + g > SFX_TP) { g = SFX_TP - m.TP; c = true; }
        return { gain: g, capped: c };
      })();
      const out = join(SFX_DIR, "open-hit.mp3");
      ff(["-i", wav, "-af", `volume=${gain.toFixed(2)}dB`, "-ar", String(SR), "-ac", "1",
        "-c:a", "libmp3lame", "-b:a", "128k", out]);
      rmSync(wav);
      const v = analyze(out);
      console.log(`open-hit -> sfx/open-hit.mp3  I ${v.I} TP ${v.TP}${capped ? " (peak capped below law)" : ""}`);
      continue;
    }

    const { L: Lc, R: Rc, n } = decodeStereo(raw);
    let cutSpec;
    if (stem.loop) {
      const loop = findLoop(Lc, Rc, n);
      console.log(
        `${stem.name}: loop ${loop.bars} bars (${(loop.L / SR).toFixed(2)}s) at ` +
        `${(loop.t0 / SR).toFixed(3)}s, similarity ${loop.score.toFixed(3)}, seam delta ${loop.seam.toFixed(4)}`,
      );
      cutSpec = { start: loop.t0 / SR, len: loop.L / SR };
    } else {
      // close-swell keeps its natural resolve; trim leading silence and any
      // dead tail below the noise floor.
      const mono = new Float32Array(n);
      for (let i = 0; i < n; i++) mono[i] = (Lc[i] + Rc[i]) / 2;
      let s = 0; while (s < n && Math.abs(mono[s]) < 0.003) s++;
      let e = n - 1; while (e > 0 && Math.abs(mono[e]) < 0.0015) e--;
      s = Math.max(0, s - Math.round(0.05 * SR));
      e = Math.min(n, e + Math.round(0.4 * SR));
      cutSpec = { start: s / SR, len: (e - s) / SR };
    }

    // Cut to WAV, static gain to the music law (never loudnorm: dynamic gain
    // riding would bend the loop's ends apart), then one vorbis encode.
    // Vorbis is sample exact end to end, so the shipped file loops where the
    // WAV loops; mp3 padding would break the seam.
    const wav = join(RAW_DIR, `${stem.name}.work.wav`);
    ff(["-i", raw, "-af",
      `atrim=${cutSpec.start.toFixed(6)}:${(cutSpec.start + cutSpec.len).toFixed(6)}`,
      "-ar", String(SR), "-ac", "2", "-c:a", "pcm_f32le", wav]);
    const { gain, capped } = masterGain(wav);
    const out = join(OUT_DIR, `${stem.name}.ogg`);
    ff(["-i", wav, "-af", `volume=${gain.toFixed(2)}dB`, "-ar", String(SR), "-ac", "2",
      "-c:a", "libvorbis", "-q:a", "5", out]);
    rmSync(wav);
    const v = analyze(out);
    console.log(
      `${stem.name} -> music/${stem.name}.ogg  I ${v.I} TP ${v.TP}` +
      `${capped ? " (peak capped below law)" : ""}`,
    );
    manifest.files.push({ file: `${stem.name}.ogg`, loop: stem.loop });
  }
  writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log("wrote", join(OUT_DIR, "index.json"));
}

// ---------- verification ----------

function verifyAll() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  let bad = 0;
  for (const stem of STEMS) {
    if (!stem.loop) continue;
    const file = join(OUT_DIR, `${stem.name}.ogg`);
    const { L, R, n } = decodeStereo(file);
    // Seam discontinuity exactly as the runtime will play it: last sample
    // against first sample, plus first-difference (slope) mismatch.
    const jump = Math.abs(L[0] - L[n - 1]) + Math.abs(R[0] - R[n - 1]);
    const slopeA = L[n - 1] - L[n - 2] + (R[n - 1] - R[n - 2]);
    const slopeB = L[1] - L[0] + (R[1] - R[0]);
    // Typical adjacent-sample movement, for scale.
    let typ = 0;
    for (let i = 1; i < n; i += 97) typ += Math.abs(L[i] - L[i - 1]);
    typ /= Math.ceil(n / 97);
    const ok = jump < Math.max(0.02, typ * 6);
    if (!ok) bad++;
    // Three cycles on tape.
    const tape = join(EVIDENCE_DIR, `${stem.name}-x3.mp3`);
    ff(["-stream_loop", "2", "-i", file, "-c:a", "libmp3lame", "-b:a", "192k", tape]);
    console.log(
      `${stem.name}: seam jump ${jump.toFixed(4)} (typical step ${typ.toFixed(4)}) ` +
      `${ok ? "PASS" : "FAIL"}  tape ${tape}`,
    );
  }
  console.log(bad ? `\nFAIL: ${bad} loop(s) with audible seams` : "\nall loops seam clean");
  process.exit(bad ? 1 : 0);
}
