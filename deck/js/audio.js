/* Deck audio: local files only, generated once by tools/deck/make-audio.mjs
   and committed under assets/audio/. Narration is per scene, toggled with N
   (off by default, on by default in ?auto). SFX play whenever audio is
   unlocked, ducked under narration. Reduced motion means no audio at all.
   Missing files (narration awaiting sign off) simply skip; the deck never
   depends on them. */

(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const REDUCED =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    params.has("reduced");
  // Silent presenter mode is the stage default; autoplay and showcase runs
  // narrate. ?narrate forces it on for a manual showcase drive.
  let narrationOn = params.has("auto") || params.has("narrate");

  const SFX_NAMES = ["draw", "stop-pop", "card-deal", "type-tick", "chime", "odometer", "swoosh", "swell"];
  const SFX_GAIN = { "stop-pop": 0.5, "type-tick": 0.45, odometer: 0.5, chime: 0.6, "card-deal": 0.55, draw: 0.5, swoosh: 0.55, swell: 0.7 };
  const NARR_KEYS = Array.from({ length: 10 }, (_, i) => "s" + String(i + 1).padStart(2, "0"));

  const buffers = new Map(); // url key -> AudioBuffer
  let ctx = null;
  let sfxBus = null;
  let narrBus = null;
  let narrSource = null;
  let narrEndCbs = [];
  let narrPlaying = false;

  function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.8;
    sfxBus.connect(ctx.destination);
    narrBus = ctx.createGain();
    narrBus.gain.value = 1.0;
    narrBus.connect(ctx.destination);
    return ctx;
  }

  async function load(key, url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.arrayBuffer();
      const c = ensureContext();
      if (!c) return;
      buffers.set(key, await c.decodeAudioData(data));
    } catch (_e) {
      /* a missing or undecodable file is never fatal */
    }
  }

  function preload() {
    if (REDUCED) return;
    SFX_NAMES.forEach((n) => load("sfx:" + n, "assets/audio/sfx/" + n + ".mp3"));
    // The manifest lists which narration files exist (make-audio.mjs keeps
    // it current), so a not yet generated set never spams 404s on stage.
    fetch("assets/audio/narration/index.json")
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((m) => {
        (m.files || []).forEach((f) => {
          const k = f.replace(/\.mp3$/, "");
          if (NARR_KEYS.includes(k)) load("narr:" + k, "assets/audio/narration/" + f);
        });
      })
      .catch(() => {});
  }

  function unlocked() {
    return ctx && ctx.state === "running";
  }

  function unlock() {
    if (REDUCED) return;
    const c = ensureContext();
    if (c && c.state === "suspended") c.resume().catch(() => {});
  }
  // Browsers gate audio behind the first gesture; any press or click frees it.
  document.addEventListener("keydown", unlock, { capture: true });
  document.addEventListener("pointerdown", unlock, { capture: true });

  // SFX sit lower while the voice speaks, documentary style.
  function duck() {
    if (!sfxBus) return;
    const t = ctx.currentTime;
    sfxBus.gain.cancelScheduledValues(t);
    sfxBus.gain.setTargetAtTime(narrPlaying ? 0.35 : 0.8, t, 0.12);
  }

  function stopNarration() {
    if (narrSource) {
      try { narrSource.onended = null; narrSource.stop(); } catch (_e) { /* already done */ }
      narrSource = null;
    }
    narrPlaying = false;
    narrEndCbs = [];
    duck();
  }

  function fireNarrEnd() {
    narrPlaying = false;
    duck();
    const cbs = narrEndCbs;
    narrEndCbs = [];
    cbs.forEach((cb) => { try { cb(); } catch (_e) { /* listener errors stay local */ } });
  }

  let currentSceneIndex = -1;

  function playNarration(index) {
    stopNarration();
    if (REDUCED || !narrationOn || !unlocked()) return;
    const buf = buffers.get("narr:" + NARR_KEYS[index]);
    if (!buf) return;
    narrSource = ctx.createBufferSource();
    narrSource.buffer = buf;
    narrSource.connect(narrBus);
    narrSource.onended = fireNarrEnd;
    narrPlaying = true;
    duck();
    narrSource.start();
  }

  window.SVK_AUDIO = {
    preload,
    sfx(name) {
      if (REDUCED || !unlocked()) return;
      const buf = buffers.get("sfx:" + name);
      if (!buf) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = SFX_GAIN[name] ?? 0.6;
      src.connect(g);
      g.connect(sfxBus);
      src.start();
    },
    onScene(index) {
      currentSceneIndex = index;
      playNarration(index);
    },
    toggleNarration() {
      narrationOn = !narrationOn;
      if (narrationOn) {
        unlock();
        if (currentSceneIndex >= 0) playNarration(currentSceneIndex);
      } else {
        stopNarration();
      }
      return narrationOn;
    },
    get narrationOn() { return narrationOn; },
    narrationActive() { return narrPlaying; },
    onceNarrationEnd(cb) {
      if (!narrPlaying) { cb(); return; }
      narrEndCbs.push(cb);
    },
  };
})();
