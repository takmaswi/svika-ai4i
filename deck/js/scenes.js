/* Scene choreography. One builder per scene, keyed by section id.
   A builder returns { beats: [fn, ...], onLeave }: beats[0] plays on entry,
   later beats ride the advance key, so the turntable and the flywheel scrub
   without the presenter ever touching a scroll wheel.
   Durations always pass through ctx.d() so reduced motion settles scenes
   instantly; infinite tweens are skipped under reduced motion entirely. */

(function () {
  "use strict";

  gsap.registerPlugin(ScrollTrigger, SplitText, Flip, MotionPathPlugin);

  const EASE_RISE = "power2.out";
  const EASE_DRIVE = "power3.out";

  // svk-rise, the entrance from the motion table.
  function rise(ctx, targets, opts = {}) {
    return gsap.from(targets, {
      opacity: 0,
      y: 14,
      duration: ctx.d(0.6),
      ease: EASE_RISE,
      stagger: ctx.d(opts.stagger ?? 0.09),
      delay: ctx.d(opts.delay ?? 0),
    });
  }

  function titleReveal(ctx, el, delay = 0) {
    const split = new SplitText(el, { type: "words" });
    return gsap.from(split.words, {
      opacity: 0,
      y: 26,
      duration: ctx.d(0.7),
      ease: EASE_DRIVE,
      stagger: ctx.d(0.05),
      delay: ctx.d(delay),
    });
  }

  // Route reveal masks carry pathLength=1 dasharray=1 offset=1 (svk-draw).
  function drawMask(ctx, sel, dur, delay = 0) {
    return gsap.to(sel, { strokeDashoffset: 0, duration: ctx.d(dur), ease: "power1.inOut", delay: ctx.d(delay) });
  }

  // Free path drawing for the flywheel traces.
  function drawPath(ctx, pathEl, dur, delay = 0) {
    const len = pathEl.getTotalLength();
    pathEl.style.strokeDasharray = len;
    pathEl.style.strokeDashoffset = len;
    return gsap.to(pathEl, { strokeDashoffset: 0, duration: ctx.d(dur), ease: "power1.inOut", delay: ctx.d(delay) });
  }

  function countTo(ctx, el, target, dur = 1.1) {
    const obj = { v: Number(el.textContent) || 0 };
    return gsap.to(obj, {
      v: target,
      duration: ctx.d(dur),
      ease: "power1.out",
      onUpdate: () => { el.textContent = Math.round(obj.v); },
    });
  }

  const B = {};

  /* ---------- 1 · Cold open ---------- */
  B["s1-cold-open"] = function (el, ctx) {
    const beamG = el.querySelector("#s1-beam-group");
    const wordmark = el.querySelector("#s1-wordmark");
    return {
      beats: [
        () => {
          const tl = ctx.track(gsap.timeline());
          gsap.set(wordmark, { opacity: 0, y: 18 });
          // Headlight sweep across the char night before anything exists.
          tl.set(beamG, { opacity: 0, transformOrigin: "130px 0px", rotation: -6, x: -140, y: 430 })
            .to(beamG, { opacity: 1, duration: ctx.d(0.5), ease: "power1.in" })
            .to(beamG, { x: 1500, rotation: 8, duration: ctx.d(2.1), ease: "power2.inOut" }, "<")
            .to(beamG, { opacity: 0, duration: ctx.d(0.4) }, ">-0.4");
          if (ctx.kombi) {
            tl.call(() => ctx.kombi.show({ theme: "night", color: "white" }), null, ctx.d(1.1));
            if (ctx.kombi.mode === "webgl") {
              tl.add(ctx.kombi.entrance({ duration: ctx.d(2.2) }), ctx.d(1.2));
              tl.call(() => ctx.kombi.setFloat(true), null, ctx.d(3.2));
            }
          }
          tl.to(wordmark, { opacity: 1, y: 0, duration: ctx.d(0.7), ease: EASE_DRIVE }, ctx.d(2.6));
        },
        // Turntable: repeated advance walks the kombi around.
        () => { if (ctx.kombi) ctx.track(ctx.kombi.spin(Math.PI * 2 / 3, ctx.d(1.4))); },
        () => { if (ctx.kombi) ctx.track(ctx.kombi.spin(Math.PI * 2 / 3, ctx.d(1.4))); },
      ],
      onLeave: () => {
        if (ctx.kombi) { ctx.kombi.setFloat(false); ctx.kombi.hide(); }
      },
    };
  };

  /* ---------- 2 · The ride that started it ---------- */
  B["s2-founding-ride"] = function (el, ctx) {
    return {
      beats: [
        () => {
          const tl = ctx.track(gsap.timeline());
          tl.add(titleReveal(ctx, el.querySelector("#s2-title")))
            .add(rise(ctx, [el.querySelector(".scene-kicker"), el.querySelector("#s2-body"), el.querySelector("#s2-map")], { stagger: 0.12 }), 0)
            .add(drawMask(ctx, "#s2-route-reveal", 1.5), ctx.d(0.6))
            .to("#s2-drop-pin", { opacity: 1, duration: ctx.d(0.4) }, ">-0.1");
        },
        () => {
          // The long lonely walk, drawn slowly on purpose.
          const tl = ctx.track(gsap.timeline());
          tl.add(drawMask(ctx, "#s2-walk-reveal", 2.4))
            .to("#s2-home", { opacity: 1, duration: ctx.d(0.5) }, ">-0.2")
            .to("#s2-caption", { opacity: 1, duration: ctx.d(0.6) }, ">-0.1");
        },
      ],
    };
  };

  window.SVK_BUILDERS = B;
})();
