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


  window.SVK_BUILDERS = B;
})();
