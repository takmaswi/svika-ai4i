// Studio tool: generates the deck's audio ONCE via ElevenLabs and caches it
// as committed files under deck/assets/audio/. The deck at runtime loads
// only these local files; ElevenLabs is never a runtime dependency.
//
//   node make-audio.mjs samples            one sample line per candidate
//                                          voice, for Mhofu's pick
//   node make-audio.mjs sfx                the sound effect set
//   node make-audio.mjs narration <voice>  all ten scene narrations with the
//                                          chosen voice id (run only after
//                                          Mhofu signs off the script)
//
// The API key lives in ../../.env.local as ELEVENLABS_API_KEY and is never
// printed, logged or written anywhere.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NARRATION, SFX, SAMPLE_LINE } from "./narration.mjs";

const AUDIO_DIR = join("..", "..", "deck", "assets", "audio");

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

const KEY = apiKey();

const VOICES = {
  "takunda-shona-man": "qBHYpnF7IndeZmja6FII", // "Takunda Zimbabwean Shona Man"
  "takunda-man": "wRW2mPeN6V5fVfWsUQjX", // "Takunda Zimbabwean Man"
};

async function tts(voiceId, text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`tts ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function sfx(text, seconds) {
  const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({ text, duration_seconds: seconds, prompt_influence: 0.55 }),
  });
  if (!res.ok) throw new Error(`sfx ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

const mode = process.argv[2];

if (mode === "samples") {
  const dir = join(AUDIO_DIR, "samples");
  mkdirSync(dir, { recursive: true });
  for (const [name, id] of Object.entries(VOICES)) {
    const buf = await tts(id, SAMPLE_LINE);
    const file = join(dir, `${name}.mp3`);
    writeFileSync(file, buf);
    console.log("wrote", file, `(${(buf.length / 1024).toFixed(0)}kb)`);
  }
  console.log("play both, pick one, then: node make-audio.mjs narration <takunda-shona-man|takunda-man>");
} else if (mode === "sfx") {
  const dir = join(AUDIO_DIR, "sfx");
  mkdirSync(dir, { recursive: true });
  for (const s of SFX) {
    const buf = await sfx(s.text, s.seconds);
    const file = join(dir, `${s.name}.mp3`);
    writeFileSync(file, buf);
    console.log("wrote", file, `(${(buf.length / 1024).toFixed(0)}kb)`);
  }
} else if (mode === "narration") {
  const pick = process.argv[3];
  const voiceId = VOICES[pick] || pick;
  if (!voiceId || voiceId.length < 12) {
    console.error("usage: node make-audio.mjs narration <takunda-shona-man|takunda-man|voiceId>");
    process.exit(1);
  }
  const dir = join(AUDIO_DIR, "narration");
  mkdirSync(dir, { recursive: true });
  for (const n of NARRATION) {
    const buf = await tts(voiceId, n.text);
    const file = join(dir, `${n.scene}.mp3`);
    writeFileSync(file, buf);
    console.log("wrote", file, `(${(buf.length / 1024).toFixed(0)}kb)`);
  }
  // The runtime reads this manifest and only fetches what exists.
  writeFileSync(
    join(dir, "index.json"),
    JSON.stringify({ files: NARRATION.map((n) => n.scene + ".mp3") }, null, 2) + "\n",
  );
  console.log("wrote", join(dir, "index.json"));
} else {
  console.error("usage: node make-audio.mjs <samples|sfx|narration>");
  process.exit(1);
}
