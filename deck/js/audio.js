/* Deck audio: local files only, generated once by tools/deck/make-audio.mjs
   and committed under assets/audio/. Narration is per scene, toggled with N
   (off by default, on by default in ?auto). SFX play whenever audio is
   unlocked, ducked under narration. Reduced motion means no audio at all.
   A missing file simply skips; the deck never depends on one. */

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
  const NARR_KEYS = Array.from({ length: 10 }, (_, i) => "s" + String(i + 1).padStart(2, "0"));

  // The mix law. Assets are mastered to one loudness target by
  // tools/deck/master-audio.mjs, so no per file gain lives in code. SFX duck
  // to 40 percent under the voice with a soft ramp: fast down, slow back up
  // (setTargetAtTime reaches ~95 percent at 3 time constants).
  const DUCK_LEVEL = 0.4;
  const DUCK_DOWN_TC = 0.027; // ~80ms down
  const DUCK_UP_TC = 0.13; // ~400ms back up
  const NARR_DELAY_MS = 300; // breathing space after a scene's entrance begins
  const NARR_FADE_S = 0.18; // scene exit fades the voice, never chops it
  const NARR_TAIL_MS = 600; // silence owed after a line before autoplay moves on

  // Master headroom: voice true peak (-1.5 dBTP) plus a coinciding ducked
  // cue peak sums past 0 dBFS and clips the destination; -2 dB on the master
  // keeps the worst measured stack (resampling and capture overs included)
  // comfortably under -1 dBTP; 0.8 still grazed 0 dBFS on tape.
  const MASTER_GAIN = 0.7;

  const buffers = new Map(); // url key -> AudioBuffer
  let ctx = null;
  let masterBus = null;
  let sfxBus = null;
  let narrBus = null;
  let narrSource = null;
  let narrGain = null;
  let narrTimer = null;
  let narrEndCbs = [];
  let narrPlaying = false;
  let narrEndedAt = 0;

  function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterBus = ctx.createGain();
    masterBus.gain.value = MASTER_GAIN;
    masterBus.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 1.0;
    sfxBus.connect(masterBus);
    narrBus = ctx.createGain();
    narrBus.gain.value = 1.0;
    narrBus.connect(masterBus);
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

  // The deck reports ready only after every asset is fully decoded to an
  // AudioBuffer: no decode ever happens during a run (the stutter ruling).
  let preloaded = false;
  let readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });
  function preload() {
    if (preloaded) return ready;
    preloaded = true;
    if (REDUCED) { readyResolve(); return ready; }
    const jobs = SFX_NAMES.map((n) => load("sfx:" + n, "assets/audio/sfx/" + n + ".mp3"));
    // The manifest lists which narration files exist (make-audio.mjs keeps
    // it current), so a not yet generated set never spams 404s on stage.
    jobs.push(
      fetch("assets/audio/narration/index.json")
        .then((r) => (r.ok ? r.json() : { files: [] }))
        .then((m) =>
          Promise.all(
            (m.files || []).map((f) => {
              const k = f.replace(/\.mp3$/, "");
              if (NARR_KEYS.includes(k)) return load("narr:" + k, "assets/audio/narration/" + f);
              return null;
            }),
          ),
        )
        .catch(() => {}),
    );
    Promise.allSettled(jobs).then(() => readyResolve());
    return ready;
  }

  function unlocked() {
    return ctx && ctx.state === "running";
  }

  function unlock() {
    if (REDUCED) return Promise.resolve();
    const c = ensureContext();
    if (c && c.state === "suspended") {
      return c.resume().then(onUnlocked).catch(() => {});
    }
    return Promise.resolve();
  }
  // A line whose scene entered while the context was still locked starts on
  // the unlocking gesture instead of staying silent for the whole scene.
  function onUnlocked() {
    if (narrationOn && currentSceneIndex >= 0 && !narrPlaying && narrTimer === null) {
      scheduleNarration(currentSceneIndex);
    }
  }
  // Browsers gate audio behind the first gesture; any press or click frees it.
  document.addEventListener("keydown", unlock, { capture: true });
  document.addEventListener("pointerdown", unlock, { capture: true });

  // SFX sit lower while the voice speaks, documentary style. `at` lets the
  // duck ramp ride the audio clock beside a scheduled narration start.
  function duck(at) {
    if (!sfxBus) return;
    const t = at || ctx.currentTime;
    sfxBus.gain.cancelScheduledValues(t);
    sfxBus.gain.setTargetAtTime(
      narrPlaying ? DUCK_LEVEL : 1.0,
      t,
      narrPlaying ? DUCK_DOWN_TC : DUCK_UP_TC,
    );
  }

  function stopNarration(fade) {
    if (narrTimer) { clearTimeout(narrTimer); narrTimer = null; }
    if (narrSource) {
      const src = narrSource;
      const g = narrGain;
      src.onended = null;
      try {
        if (fade && g) {
          const t = ctx.currentTime;
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(0, t + NARR_FADE_S);
          src.stop(t + NARR_FADE_S);
        } else {
          src.stop();
        }
      } catch (_e) { /* already done */ }
      narrSource = null;
      narrGain = null;
    }
    narrPlaying = false;
    narrEndCbs = [];
    duck();
  }

  function fireNarrEnd() {
    narrPlaying = false;
    narrEndedAt = performance.now();
    duck();
    const cbs = narrEndCbs;
    narrEndCbs = [];
    cbs.forEach((cb) => { try { cb(); } catch (_e) { /* listener errors stay local */ } });
  }

  let currentSceneIndex = -1;

  // The voice never lands on the exact frame of a visual pop: it starts a
  // breath after the scene's entrance begins, scheduled on the audio clock
  // (a JS timer start can land late under main thread load; the audio
  // thread never does). Stopping the source cancels the schedule.
  function scheduleNarration(index) {
    stopNarration(true);
    if (REDUCED || !narrationOn) return;
    const buf = buffers.get("narr:" + NARR_KEYS[index]);
    if (!buf || !unlocked()) {
      // The line cannot start (file missing, context locked): anyone
      // waiting on the end must not wait forever. Same breath, then flush.
      narrTimer = setTimeout(() => {
        narrTimer = null;
        const cbs = narrEndCbs;
        narrEndCbs = [];
        cbs.forEach((cb) => { try { cb(); } catch (_e) { /* stays local */ } });
      }, NARR_DELAY_MS);
      return;
    }
    const at = ctx.currentTime + NARR_DELAY_MS / 1000;
    narrSource = ctx.createBufferSource();
    narrSource.buffer = buf;
    narrGain = ctx.createGain();
    narrSource.connect(narrGain);
    narrGain.connect(narrBus);
    narrSource.onended = fireNarrEnd;
    narrPlaying = true;
    narrEndedAt = 0;
    duck(at);
    narrSource.start(at);
  }

  window.SVK_AUDIO = {
    preload,
    ready,
    sfx(name) {
      if (REDUCED || !unlocked()) return;
      const buf = buffers.get("sfx:" + name);
      if (!buf) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(sfxBus);
      src.start();
    },
    onScene(index) {
      currentSceneIndex = index;
      narrEndedAt = 0; // a finished line's tail never leaks into the next scene
      scheduleNarration(index);
    },
    toggleNarration() {
      narrationOn = !narrationOn;
      if (narrationOn) {
        // A locked context reschedules from onUnlocked once resume lands.
        if (unlocked() && currentSceneIndex >= 0) scheduleNarration(currentSceneIndex);
        else unlock();
      } else {
        stopNarration(true);
      }
      return narrationOn;
    },
    get narrationOn() { return narrationOn; },
    narrationActive() { return narrPlaying || narrTimer !== null; },
    onceNarrationEnd(cb) {
      if (!narrPlaying && narrTimer === null) { cb(); return; }
      narrEndCbs.push(cb);
    },
    // How much of the post line silence autoplay still owes before it may
    // change the scene. Zero when no line played or the breath has passed.
    narrationTailRemaining() {
      if (!narrEndedAt) return 0;
      return Math.max(0, NARR_TAIL_MS - (performance.now() - narrEndedAt));
    },
  };

  // Decode starts now, not at engine boot: the engine waits on the 3D model,
  // and scene 1's first cue lands 0.65s in, before a boot time decode would
  // finish. A cue with no buffer skips silently, so warm the cache early.
  preload();
})();
