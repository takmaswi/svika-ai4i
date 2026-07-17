/* Scene engine: stepped scenes, beats within scenes, progress rail,
   autoplay (?auto), fullscreen (f), reduced motion, hash deep links.
   Advancing consumes a scene's remaining beats before moving on, which is
   how the scrub scenes (turntable, flywheel) ride the same key. */

(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const AUTO = params.has("auto");
  const REDUCED =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    params.has("reduced");
  const NO_WEBGL = params.has("nowebgl");

  // ?nolag: exact-time tweens for automated capture rigs running on software
  // WebGL, where lag smoothing would stretch every entrance. Never needed on
  // a real GPU.
  if (params.has("nolag")) gsap.ticker.lagSmoothing(0);

  // Beat hold in auto mode, per scene overridable via data-auto-hold (ms).
  const AUTO_HOLD_DEFAULT = 3600;

  const sceneEls = Array.from(document.querySelectorAll(".scene"));
  const rail = document.getElementById("rail");
  const counter = document.getElementById("hud-counter");

  // scenes.js fills this: index -> builder(el, ctx) returning
  // { beats: [fn, ...], onLeave?: fn }. beats[0] runs on entry.
  const builders = window.SVK_BUILDERS || {};

  const ctx = {
    REDUCED,
    NO_WEBGL,
    AUTO,
    // Duration helper: collapses under reduced motion.
    d: (x) => (REDUCED ? 0.001 : x),
    kombi: null, // set by kombi3d bootstrap below
  };

  let current = -1;
  let beatQueue = [];
  let leaveFn = null;
  let autoTimer = null;
  let sceneTweens = [];
  let beatTweens = []; // tweens started by the most recent beat only
  let sfxCalls = []; // pending delayed sound cues, cancellable on settle
  let lastNavAt = 0; // input debounce clock

  // Track tweens per scene so leaving a scene never leaks infinite loops.
  // Finite tweens are also tracked per beat so a press during a running
  // entrance completes it instead of silently firing the next beat.
  // Guard against undefined: the fallback kombi api's spin/entrance return
  // nothing, and scenes hand their result straight to track.
  ctx.track = function track(t) {
    if (t) {
      sceneTweens.push(t);
      beatTweens.push(t);
    }
    return t;
  };

  function runBeat(fn) {
    beatTweens = [];
    sfxCalls = [];
    fn();
  }

  // Delayed sound cue inside a beat. Settling or leaving cancels pending
  // cues instead of firing them, so a fast press never machine-guns audio.
  ctx.sfx = function sfx(name, delay = 0) {
    if (REDUCED || !window.SVK_AUDIO) return;
    if (delay <= 0) {
      window.SVK_AUDIO.sfx(name);
      return;
    }
    sfxCalls.push(gsap.delayedCall(delay, () => window.SVK_AUDIO.sfx(name)));
  };

  function killPendingSfx() {
    sfxCalls.forEach((c) => c.kill());
    sfxCalls = [];
  }

  // Endless ambience (caret blink, kombi bob) is never part of a beat's
  // payload; only finite tweens count as "the beat still running".
  function isEndless(t) {
    return (t.repeat && t.repeat() === -1) || t.totalDuration() === Infinity;
  }

  // A press while the current beat is still animating fast-forwards it to
  // its end state. Every press then has a visible result: first press lands
  // the beat, next press moves on. totalProgress (not isActive) catches
  // tweens still waiting out a delay, which isActive reports as idle.
  function beatActive() {
    return beatTweens.some((t) => !isEndless(t) && t.totalProgress() < 1);
  }

  function settleRunningBeat() {
    let settled = false;
    killPendingSfx(); // future sound cues die silently, they do not stack
    // Index loop, not forEach: settling can fire onComplete chains that
    // track new tweens mid-walk, and those must settle in the same press.
    for (let i = 0; i < beatTweens.length; i++) {
      const t = beatTweens[i];
      if (isEndless(t)) continue;
      if (t.totalProgress() < 1) {
        t.totalProgress(1);
        settled = true;
      }
    }
    return settled;
  }

  function killSceneAnimations() {
    sceneTweens.forEach((t) => t.kill());
    sceneTweens = [];
    beatTweens = []; // never let a dead scene's tweens read as a running beat
    killPendingSfx();
  }

  function setTheme(theme) {
    document.body.classList.toggle("theme-day", theme === "day");
  }

  function renderRail() {
    rail.querySelectorAll("button").forEach((b, i) => {
      b.classList.toggle("is-current", i === current);
    });
    counter.textContent =
      String(current + 1).padStart(2, "0") + " / " + String(sceneEls.length).padStart(2, "0");
  }

  function scheduleAuto() {
    if (!AUTO) return;
    clearTimeout(autoTimer);
    const hold = Number(sceneEls[current].dataset.autoHold || AUTO_HOLD_DEFAULT);
    autoTimer = setTimeout(() => {
      const audio = window.SVK_AUDIO;
      // With narration on, a scene holds until its voice line finishes or
      // the hold elapses, whichever is longer, then leaves a breath of
      // silence before the cut so lines never feel clipped; beats inside a
      // scene still ride the hold alone.
      const sceneDone = !beatQueue.length;
      if (sceneDone && audio && audio.narrationActive()) {
        audio.onceNarrationEnd(() => {
          autoTimer = setTimeout(() => advance(), audio.narrationTailRemaining());
        });
      } else if (sceneDone && audio && audio.narrationTailRemaining() > 0) {
        autoTimer = setTimeout(() => advance(), audio.narrationTailRemaining());
      } else {
        advance();
      }
    }, REDUCED ? Math.min(hold, 2200) : hold);
  }

  function go(index, viaHash) {
    const n = sceneEls.length;
    index = ((index % n) + n) % n; // auto mode loops past the end
    if (index === current) return;

    if (leaveFn) { try { leaveFn(); } catch (_e) { /* leave must never block nav */ } leaveFn = null; }
    killSceneAnimations();

    if (current >= 0) sceneEls[current].classList.remove("is-active");
    current = index;
    const el = sceneEls[current];
    el.classList.add("is-active");
    setTheme(el.dataset.theme || "night");

    const builder = builders[el.id];
    beatQueue = [];
    if (builder) {
      const built = builder(el, ctx) || {};
      const beats = built.beats || [];
      leaveFn = built.onLeave || null;
      if (REDUCED) {
        // Scenes settle instantly: run every beat now, end state on screen.
        beats.forEach((fn) => fn());
      } else {
        if (beats.length) runBeat(beats[0]);
        beatQueue = beats.slice(1);
      }
    }

    if (!viaHash) history.replaceState(null, "", "#" + el.id);
    if (window.SVK_AUDIO) window.SVK_AUDIO.onScene(current);
    renderRail();
    scheduleAuto();
  }

  // Debounce shared by advance and back: key auto-repeat and the ghost of a
  // tap arriving as both pointer and click can otherwise fire twice.
  function navReady() {
    const now = performance.now();
    if (now - lastNavAt < 220) return false;
    lastNavAt = now;
    return true;
  }

  function advance() {
    if (beatQueue.length) {
      runBeat(beatQueue.shift());
      scheduleAuto();
    } else {
      go(current + 1);
    }
  }

  // User input path only: the debounce and settle-then-step never apply to
  // the auto timer, or a press just before it fires would stall the loop.
  function userAdvance() {
    if (!navReady()) return;
    if (!AUTO && settleRunningBeat()) return;
    advance();
  }

  function userBack() {
    if (!navReady()) return;
    go(current - 1);
  }

  // ---------- Narration toggle (N) ----------
  const hudAudio = document.getElementById("hud-audio");
  function renderAudioHud() {
    if (!hudAudio) return;
    if (REDUCED || !window.SVK_AUDIO) { hudAudio.textContent = ""; return; }
    hudAudio.textContent = "n narration " + (window.SVK_AUDIO.narrationOn ? "on" : "off");
  }

  // ---------- Input ----------
  document.addEventListener("keydown", (e) => {
    if (e.repeat) return; // holding a key must not machine-gun the deck
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown" || e.key === "Enter") {
      // preventDefault also stops a focused button from re-firing its click
      // on Space/Enter, which used to advance twice in one press.
      e.preventDefault();
      userAdvance();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      userBack();
    } else if (e.key === "Home") {
      go(0);
    } else if (e.key === "End") {
      go(sceneEls.length - 1);
    } else if (e.key === "f" || e.key === "F") {
      toggleFullscreen();
    } else if ((e.key === "n" || e.key === "N") && window.SVK_AUDIO && !REDUCED) {
      window.SVK_AUDIO.toggleNarration();
      renderAudioHud();
    }
  });

  document.getElementById("deck").addEventListener("click", (e) => {
    if (e.target.closest("#rail, #btn-full, a")) return;
    userAdvance();
  });

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }
  document.getElementById("btn-full").addEventListener("click", (e) => {
    e.currentTarget.blur(); // a focused button would swallow the next Space
    toggleFullscreen();
  });

  // ---------- Rail ----------
  sceneEls.forEach((el, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", "Scene " + (i + 1));
    b.addEventListener("click", () => { b.blur(); go(i); });
    rail.appendChild(b);
  });

  // ---------- Ghost numerals: the editorial scene count ----------
  sceneEls.forEach((el, i) => {
    if (el.id === "s1-cold-open") return; // the cold open stays wordless
    const n = document.createElement("span");
    n.className = "mono ghost-num";
    n.setAttribute("aria-hidden", "true");
    n.textContent = String(i + 1).padStart(2, "0");
    el.prepend(n);
  });

  // ---------- Boot ----------
  window.SVK_ENGINE = {
    go,
    advance: userAdvance,
    back: userBack,
    ctx,
    beatActive,
    get current() { return current; },
  };

  function start() {
    if (window.SVK_AUDIO) window.SVK_AUDIO.preload();
    renderAudioHud();
    const fromHash = sceneEls.findIndex((el) => "#" + el.id === location.hash);
    go(fromHash >= 0 ? fromHash : 0, true);
  }

  // The 3D layer loads first so scene 1 owns a living kombi from its first
  // frame; if WebGL is unavailable the module resolves with the poster
  // fallback and the deck carries on.
  window.SVK_BOOT = function (kombiApi) {
    ctx.kombi = kombiApi;
    start();
  };
})();
