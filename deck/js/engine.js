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

  // Track tweens per scene so leaving a scene never leaks infinite loops.
  ctx.track = function track(t) {
    sceneTweens.push(t);
    return t;
  };

  function killSceneAnimations() {
    sceneTweens.forEach((t) => t.kill());
    sceneTweens = [];
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
    autoTimer = setTimeout(() => advance(), REDUCED ? Math.min(hold, 2200) : hold);
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
        if (beats.length) beats[0]();
        beatQueue = beats.slice(1);
      }
    }

    if (!viaHash) history.replaceState(null, "", "#" + el.id);
    renderRail();
    scheduleAuto();
  }

  function advance() {
    if (beatQueue.length) {
      beatQueue.shift()();
      scheduleAuto();
    } else {
      go(current + 1);
    }
  }

  function back() {
    go(current - 1);
  }

  // ---------- Input ----------
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown" || e.key === "Enter") {
      e.preventDefault();
      advance();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      back();
    } else if (e.key === "Home") {
      go(0);
    } else if (e.key === "End") {
      go(sceneEls.length - 1);
    } else if (e.key === "f" || e.key === "F") {
      toggleFullscreen();
    }
  });

  document.getElementById("deck").addEventListener("click", (e) => {
    if (e.target.closest("#rail, #btn-full, a")) return;
    advance();
  });

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }
  document.getElementById("btn-full").addEventListener("click", toggleFullscreen);

  // ---------- Rail ----------
  sceneEls.forEach((el, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", "Scene " + (i + 1));
    b.addEventListener("click", () => go(i));
    rail.appendChild(b);
  });

  // ---------- Boot ----------
  window.SVK_ENGINE = { go, advance, back, ctx, get current() { return current; } };

  function start() {
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
