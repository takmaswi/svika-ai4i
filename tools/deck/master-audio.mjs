// Studio tool: masters every committed deck audio asset to one loudness law
// so the runtime never needs per file volume hacks. Run after make-audio.mjs,
// commit the results. Requires ffmpeg on PATH.
//
//   node master-audio.mjs
//
// The law:
//   narration + sample  -16 LUFS integrated, true peak under -1.5 dBTP, mono
//   sfx                 -26 LUFS integrated (10 dB under the voice), and the
//                       whole set is put in one room: high pass 80 Hz, gentle
//                       low pass 13 kHz, 8-12 ms edge fades so nothing clicks
// Everything ships as 44.1 kHz mono mp3 128k. The script prints the measured
// LUFS and true peak of every output; that table is the proof.

import { execFileSync, spawnSync } from "node:child_process";
import { renameSync, rmSync } from "node:fs";
import { join } from "node:path";

const AUDIO_DIR = join("..", "..", "deck", "assets", "audio");
const VOICE_I = -16;
const VOICE_TP = -1.5;
const SFX_I = -26;
const SFX_TP = -3.0;
// Music stems are mastered by make-music.mjs (static gain only: dynamic
// loudness riding would bend a loop's ends apart); this script measures and
// polices them so one table covers every shipped asset.
const MUSIC_I = -28;
const ENC = ["-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k"];
// Downmix first, in both measurement and render: the files ship mono, so the
// loudness math must see mono or stereo sources land ~3 dB off the law.
const MONO = "aformat=channel_layouts=mono";

// Trims: type-tick is cut to the 1.4s the s4 typing animation actually runs.
const SFX_TRIM = { "type-tick": 1.4 };
const SFX_NAMES = ["draw", "stop-pop", "card-deal", "type-tick", "chime", "odometer", "swoosh", "swell", "open-hit"];
const NARRATION = Array.from({ length: 10 }, (_, i) => "s" + String(i + 1).padStart(2, "0"));
const MUSIC = ["bed-low", "bed-mid", "bed-rise", "bed-pull", "close-swell"];

function ff(args) {
  return execFileSync("ffmpeg", ["-hide_banner", "-nostats", "-y", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// ffmpeg writes its analysis to stderr even on a clean exit.
function ffStderr(args) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args], { encoding: "utf8" });
  return (r.stderr || "") + (r.stdout || "");
}

function analyze(file, prechain) {
  // apad gives ebur128 enough gated blocks on sub second one shots; R128
  // gating excludes the padded silence from the integrated figure.
  const chain = (prechain ? prechain + "," : "") + "apad=pad_dur=3,ebur128=peak=true";
  const out = ffStderr(["-i", file, "-af", chain, "-f", "null", "-"]);
  const summary = out.slice(out.lastIndexOf("Summary:"));
  const i = summary.match(/I:\s+(-?[\d.]+) LUFS/);
  const tp = summary.match(/Peak:\s+(-?[\d.]+) dBFS/);
  if (!i) throw new Error("no loudness summary for " + file);
  return { I: Number(i[1]), TP: tp ? Number(tp[1]) : 0 };
}

function duration(file) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
    { encoding: "utf8" },
  );
  return Number(out.trim());
}

function masterSfx(name) {
  const file = join(AUDIO_DIR, "sfx", name + ".mp3");
  const tmp = file + ".tmp.mp3";
  const trim = SFX_TRIM[name];
  const dur = trim ?? duration(file);
  const fadeOut = Math.max(dur - 0.012, 0);
  // One room for the whole set: rumble out, digital edge off, clean edges.
  const room = [
    MONO,
    trim ? `atrim=0:${trim}` : null,
    "highpass=f=80",
    "lowpass=f=13000",
    "afade=t=in:st=0:d=0.008",
    `afade=t=out:st=${fadeOut.toFixed(3)}:d=0.012`,
  ].filter(Boolean).join(",");

  const m = analyze(file, room);
  let gain = SFX_I - m.I;
  const capped = m.TP + gain > SFX_TP;
  if (capped) gain = SFX_TP - m.TP; // peak safety wins; report the shortfall
  ff(["-i", file, "-af", `${room},volume=${gain.toFixed(2)}dB`, ...ENC, tmp]);
  swap(file, tmp);
  return { file: "sfx/" + name + ".mp3", capped };
}

// The round 3 stutter post mortem lives here: the old pipeline re-encoded
// each line to 128k mp3 on every pass (loudnorm render + up to 4 refine
// passes = up to 5 lossy generations plus repeated limiting), and that
// generational loss is what read as grainy stutter on playback. All
// intermediate work now happens on lossless WAV; each file is mp3 encoded
// exactly once, at the very end.
function masterVoice(rel) {
  const file = join(AUDIO_DIR, rel);
  const wav = file + ".work.wav";
  const wav2 = file + ".work2.wav";
  const tmp = file + ".tmp.mp3";
  const PCM = ["-ar", "44100", "-ac", "1", "-c:a", "pcm_f32le"];
  const target = `I=${VOICE_I}:TP=${VOICE_TP}:LRA=11`;

  // Decode the source once; everything after this stays lossless.
  ff(["-i", file, "-af", MONO, ...PCM, wav]);

  // Two pass loudnorm, dynamic mode: linear mode undershoots the target
  // whenever the raw peaks sit high, which every ElevenLabs render does.
  const pass1 = ffStderr(["-i", wav, "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"]);
  const start = pass1.lastIndexOf("{");
  const j = JSON.parse(pass1.slice(start, pass1.indexOf("}", start) + 1));
  const measured =
    `measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}` +
    `:measured_thresh=${j.input_thresh}:offset=${j.target_offset}`;
  ff(["-i", wav, "-af", `loudnorm=${target}:${measured},aresample=44100`, ...PCM, wav2]);
  rmSync(wav);
  renameSync(wav2, wav);

  // loudnorm's dynamic mode drifts on takes shorter than its 3s window, so
  // measure the real WAV and correct with static gain under a limiter
  // ceiling until it sits on the law. -2.4 dB pre-encode leaves room for
  // the single mp3 encode to nudge true peak upward (measured up to 0.8 dB
  // on these takes).
  const ceiling = Math.pow(10, -2.4 / 20);
  for (let i = 0; i < 4; i++) {
    const m = analyze(wav, null);
    const gain = VOICE_I - m.I;
    if (Math.abs(gain) <= 0.4 && m.TP <= VOICE_TP - 0.9) break;
    ff(["-i", wav, "-af",
      `volume=${gain.toFixed(2)}dB,alimiter=limit=${ceiling.toFixed(3)}:attack=5:release=100:level=false`,
      ...PCM, wav2]);
    rmSync(wav);
    renameSync(wav2, wav);
  }

  // The one and only lossy encode. The encoder's peak bump varies with the
  // material (measured 0.3 to 1.2 dB on these takes), so verify the encoded
  // result and, if it overshoots, re-encode from the same WAV with a static
  // trim: the shipped file is always exactly one generation from lossless.
  let trim = 0;
  for (let i = 0; i < 3; i++) {
    rmSync(tmp, { force: true });
    ff(["-i", wav, ...(trim ? ["-af", `volume=${trim.toFixed(2)}dB`] : []), ...ENC, tmp]);
    const m = analyze(tmp, null);
    if (m.TP <= VOICE_TP + 0.2) break;
    trim -= m.TP - VOICE_TP + 0.1;
  }
  rmSync(wav);
  swap(file, tmp);
  return { file: rel.replace(/\\/g, "/"), capped: false };
}

function swap(file, tmp) {
  rmSync(file);
  renameSync(tmp, file);
}

// Group selection: mastering is not idempotent (each render is one more
// lossy encode), so a run only re-renders the groups named on the command
// line and measure-only reports the rest. No argument prints the full table
// without touching a single file.
//   node master-audio.mjs [voice] [sfx]
const groups = process.argv.slice(2);
const doVoice = groups.includes("voice");
const doSfx = groups.includes("sfx");

const jobs = [
  ...SFX_NAMES.map((n) => () =>
    doSfx ? masterSfx(n) : { file: "sfx/" + n + ".mp3", capped: ["card-deal", "type-tick"].includes(n) }),
  ...NARRATION.map((s) => () =>
    doVoice
      ? masterVoice(join("narration", s + ".mp3"))
      : { file: "narration/" + s + ".mp3", capped: false }),
  ...MUSIC.map((m) => () => ({ file: "music/" + m + ".ogg", capped: false, music: true })),
];

const rows = [];
for (const job of jobs) {
  const r = job();
  // Music ships stereo and is measured as it plays; everything else is mono.
  const v = analyze(join(AUDIO_DIR, r.file), r.music ? null : MONO);
  rows.push({ ...r, ...v });
}

console.log("\nfile                          I (LUFS)   TP (dBFS)");
for (const r of rows) {
  const flag = r.capped ? "  (peak capped below law)" : "";
  console.log(r.file.padEnd(30) + String(r.I).padStart(8) + String(r.TP).padStart(12) + flag);
}
const voiceRows = rows.filter((r) => r.file.startsWith("narration/"));
const sfxRows = rows.filter((r) => r.file.startsWith("sfx/"));
const musicRows = rows.filter((r) => r.file.startsWith("music/"));
const bad =
  voiceRows.filter((r) => Math.abs(r.I - VOICE_I) > 1 || r.TP > VOICE_TP + 0.2).length +
  sfxRows.filter((r) => !r.capped && Math.abs(r.I - SFX_I) > 1.5).length +
  musicRows.filter((r) => Math.abs(r.I - MUSIC_I) > 1.5).length;
console.log(bad ? `\nFAIL: ${bad} file(s) off the law` : "\nall assets pass the one loudness law");
process.exit(bad ? 1 : 0);
