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

  /* ---------- 3 · What Svika already does ---------- */
  B["s3-real-today"] = function (el, ctx) {
    const cards = ["#s3-card-code", "#s3-card-change", "#s3-card-eta"].map((s) => el.querySelector(s));
    gsap.set(cards, { opacity: 0, y: 22 });
    function popCard(i) {
      return () => {
        const tl = ctx.track(gsap.timeline());
        tl.to(cards[i], { opacity: 1, y: 0, duration: ctx.d(0.55), ease: EASE_DRIVE });
        if (i === 2) {
          // The reference screen's 5 min to 4 min swap: the estimate lives.
          const eta = el.querySelector("#s3-eta");
          tl.to(eta, { opacity: 0, duration: ctx.d(0.3), delay: ctx.d(0.9) })
            .call(() => { eta.textContent = "4 min"; })
            .to(eta, { opacity: 1, duration: ctx.d(0.3) });
        }
      };
    }
    return {
      beats: [
        () => {
          const tl = ctx.track(gsap.timeline());
          tl.add(titleReveal(ctx, el.querySelector("#s3-title")))
            .add(rise(ctx, el.querySelector(".scene-kicker")), 0);
          popCard(0)();
        },
        popCard(1),
        popCard(2),
        () => { ctx.track(gsap.to("#s3-honest", { opacity: 1, duration: ctx.d(0.7) })); },
      ],
    };
  };

  /* ---------- 4 · Take me there ---------- */
  B["s4-take-me-there"] = function (el, ctx) {
    const typed = el.querySelector("#s4-typed");
    const caret = el.querySelector("#s4-caret");
    typed.textContent = "";
    return {
      beats: [
        () => {
          const tl = ctx.track(gsap.timeline());
          tl.add(titleReveal(ctx, el.querySelector(".scene-title")))
            .add(rise(ctx, [el.querySelector(".scene-kicker"), el.querySelector(".scene-body"), el.querySelector("#s4-search")], { stagger: 0.12 }), 0);
          if (!ctx.REDUCED) ctx.track(gsap.to(caret, { opacity: 0, duration: 0.5, yoyo: true, repeat: -1, ease: "steps(1)" }));
          const text = "Westgate turn off";
          const chars = { n: 0 };
          tl.to(chars, {
            n: text.length,
            duration: ctx.d(1.4),
            ease: "none",
            delay: ctx.d(0.5),
            onUpdate: () => { typed.textContent = text.slice(0, Math.round(chars.n)); },
          });
          if (ctx.REDUCED) typed.textContent = text;
        },
        () => { ctx.track(gsap.fromTo("#s4-plan", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: ctx.d(0.55), ease: EASE_DRIVE })); },
        () => { ctx.track(gsap.fromTo("#s4-voice", { opacity: 0, scale: 0.92, y: 10 }, { opacity: 1, scale: 1, y: 0, duration: ctx.d(0.6), ease: "back.out(1.6)" })); },
      ],
    };
  };

  /* ---------- 5 · Guardian mode ---------- */
  B["s5-guardian"] = function (el, ctx) {
    const kombiDot = el.querySelector("#s5-kombi-dot");
    return {
      beats: [
        () => {
          const tl = ctx.track(gsap.timeline());
          tl.add(titleReveal(ctx, el.querySelector(".scene-title")))
            .add(rise(ctx, [el.querySelector(".scene-kicker"), el.querySelector(".scene-body"), el.querySelector("#s5-map")], { stagger: 0.12 }), 0)
            .add(drawMask(ctx, "#s5-route-reveal", 1.5), ctx.d(0.5));
          tl.to(kombiDot, {
            motionPath: { path: "#s5-route-reveal", align: "#s5-route-reveal", alignOrigin: [0.5, 0.5] },
            duration: ctx.d(2.6),
            ease: "power1.inOut",
          }, ctx.d(0.7));
        },
        () => {
          const tl = ctx.track(gsap.timeline());
          tl.to("#s5-arrive-pin", { opacity: 1, duration: ctx.d(0.35) })
            .fromTo("#s5-notify", { opacity: 0, y: 18, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: ctx.d(0.6), ease: "back.out(1.5)" })
            .to("#s5-dignity", { opacity: 1, duration: ctx.d(0.5) }, ">-0.2");
        },
      ],
    };
  };

  /* ---------- 6 · The city maps itself (scrub) ---------- */
  B["s6-city-maps"] = function (el, ctx) {
    const svg = el.querySelector("#s6-canvas");
    const art = window.SVK_ART.buildFlywheel(svg);
    const nums = el.querySelectorAll(".counter-num");
    nums.forEach((n) => { n.textContent = "0"; });
    art.waves.flat().forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
    });
    art.shortcuts.forEach((p) => { p.style.opacity = 0; });

    function wave(i, counts) {
      const tl = ctx.track(gsap.timeline());
      art.waves[i].forEach((p, j) => tl.add(drawPath(ctx, p, 1.4), ctx.d(j * 0.12)));
      tl.add(countTo(ctx, nums[0], counts[0]), 0);
      tl.add(countTo(ctx, nums[1], counts[1]), 0);
      tl.add(countTo(ctx, nums[2], counts[2]), 0);
      return tl;
    }

    return {
      beats: [
        () => {
          const tl = ctx.track(gsap.timeline());
          tl.add(titleReveal(ctx, el.querySelector(".scene-title")))
            .add(rise(ctx, [el.querySelector(".scene-kicker"), el.querySelector("#s6-counters")], { stagger: 0.15 }), 0);
          wave(0, [12, 3, 1]);
        },
        () => { wave(1, [87, 26, 9]); },
        () => {
          wave(2, [412, 118, 37]);
          const tl = ctx.track(gsap.timeline({ delay: ctx.d(0.8) }));
          art.shortcuts.forEach((p, j) => {
            tl.to(p, { opacity: 0.9, duration: ctx.d(0.5) }, ctx.d(j * 0.2));
            tl.add(drawPath(ctx, p, 0.9), "<");
          });
          art.chips.forEach((c, j) => {
            tl.to(c, { opacity: 1, duration: ctx.d(0.45) }, ctx.d(0.4 + j * 0.35));
          });
        },
      ],
    };
  };

  /* ---------- 7 · Send a ride, not money ---------- */
  B["s7-send-a-ride"] = function (el, ctx) {
    const ticket = el.querySelector("#s7-ticket");
    const landing = el.querySelector("#s7-landing");
    return {
      beats: [
        () => {
          const tl = ctx.track(gsap.timeline());
          tl.add(titleReveal(ctx, el.querySelector(".scene-title")))
            .add(rise(ctx, [el.querySelector(".scene-kicker"), el.querySelector("#s7-phone-a"), el.querySelector("#s7-phone-b")], { stagger: 0.14 }), 0);
        },
        () => {
          // Flip carries the real ticket node from one phone to the other.
          const state = Flip.getState(ticket);
          landing.appendChild(ticket);
          ticket.style.margin = "0";
          const tl = ctx.track(gsap.timeline());
          tl.add(Flip.from(state, { duration: ctx.d(1.1), ease: "power3.inOut", absolute: true }))
            .to("#s7-arrow", { opacity: 1, duration: ctx.d(0.4) }, ctx.d(0.15))
            .to("#s7-arrow", { x: 14, duration: ctx.d(0.7), ease: EASE_DRIVE }, "<");
        },
        () => { ctx.track(gsap.fromTo("#s7-horizon", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: ctx.d(0.65), ease: EASE_DRIVE })); },
      ],
    };
  };

  /* ---------- 8 · Kombis, employed ---------- */
  B["s8-kombis-employed"] = function (el, ctx) {
    return {
      beats: [
        () => {
          const tl = ctx.track(gsap.timeline());
          tl.add(titleReveal(ctx, el.querySelector(".scene-title")))
            .add(rise(ctx, [el.querySelector(".scene-kicker"), el.querySelector(".scene-body")], { stagger: 0.12 }), 0)
            .fromTo("#s8-sun", { attr: { cy: 430 } }, { attr: { cy: 250 }, duration: ctx.d(2.4), ease: "power1.out" }, 0)
            .fromTo("#s8-dawn", { opacity: 0 }, { opacity: 1, duration: ctx.d(0.8) }, 0)
            // The kombi parks left of the sun gap; both are marigold and
            // must never overlap.
            .fromTo("#s8-kombi", { x: -260 }, { x: 430, duration: ctx.d(2.6), ease: "power2.out" }, ctx.d(0.4));
          if (!ctx.REDUCED) {
            ctx.track(gsap.to("#s8-kombi", { y: -3, duration: 1.2, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 3 }));
          }
        },
        () => { ctx.track(gsap.to("#s8-caveat", { opacity: 1, duration: ctx.d(0.7) })); },
      ],
    };
  };

  /* ---------- 9 · Rank pulse and last kombi ---------- */
  B["s9-rank-pulse"] = function (el, ctx) {
    const pulse = el.querySelector("#s9-pulse");
    const last = el.querySelector("#s9-last");
    gsap.set([pulse, last], { opacity: 0, y: 22 });
    return {
      beats: [
        () => {
          const tl = ctx.track(gsap.timeline());
          tl.add(titleReveal(ctx, el.querySelector(".scene-title")))
            .add(rise(ctx, el.querySelector(".scene-kicker")), 0)
            .to(pulse, { opacity: 1, y: 0, duration: ctx.d(0.55), ease: EASE_DRIVE }, ctx.d(0.5));
          const seats = el.querySelector("#s9-seats");
          tl.to(seats, { opacity: 0, duration: ctx.d(0.3), delay: ctx.d(1.1) })
            .call(() => { seats.textContent = "3 seats left"; })
            .to(seats, { opacity: 1, duration: ctx.d(0.3) });
        },
        () => { ctx.track(gsap.to(last, { opacity: 1, y: 0, duration: ctx.d(0.55), ease: EASE_DRIVE })); },
      ],
    };
  };

  /* ---------- 10 · Close ---------- */
  B["s10-close"] = function (el, ctx) {
    return {
      beats: [
        () => {
          const tl = ctx.track(gsap.timeline());
          if (ctx.kombi) {
            ctx.kombi.show({ theme: "day", color: "marigold" });
            if (ctx.kombi.mode === "webgl") {
              tl.add(ctx.kombi.entrance({ duration: ctx.d(2.0), from: Math.PI + 1.36, to: Math.PI - 0.62, scale: 0.82 }), 0);
              tl.call(() => ctx.kombi.setFloat(true), null, ctx.d(2.0));
            }
          }
          tl.add(titleReveal(ctx, el.querySelector("#s10-thesis"), 0.7), 0);
        },
        () => { ctx.track(gsap.to("#s10-gdg", { opacity: 1, duration: ctx.d(0.6) })); },
        () => { ctx.track(gsap.fromTo("#s10-qr", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: ctx.d(0.6), ease: EASE_DRIVE })); },
      ],
      onLeave: () => {
        if (ctx.kombi) { ctx.kombi.setFloat(false); ctx.kombi.hide(); }
      },
    };
  };

  window.SVK_BUILDERS = B;
})();
