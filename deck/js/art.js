/* Procedural art for scene 6, the city mapping flywheel. Deterministic
   (seeded LCG) so every run and the PDF export show the same city.
   Palette and grammar from DESIGN.md section 11 night map spec; street
   labels use only the real names the spec allows. */

(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";

  function lcg(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  // A journey trace: a gentle two bend bezier crossing the city.
  function tracePath(rnd) {
    const fromLeft = rnd() > 0.5;
    const x0 = fromLeft ? -40 + rnd() * 300 : 1340 + rnd() * 300;
    const y0 = 700 + rnd() * 240;
    const x3 = 300 + rnd() * 1000;
    const y3 = -40 + rnd() * 260;
    const x1 = x0 + (x3 - x0) * 0.3 + (rnd() - 0.5) * 320;
    const y1 = y0 + (y3 - y0) * 0.35 + (rnd() - 0.5) * 180;
    const x2 = x0 + (x3 - x0) * 0.7 + (rnd() - 0.5) * 320;
    const y2 = y0 + (y3 - y0) * 0.72 + (rnd() - 0.5) * 180;
    return `M${x0.toFixed(0)} ${y0.toFixed(0)} C ${x1.toFixed(0)} ${y1.toFixed(0)}, ${x2.toFixed(0)} ${y2.toFixed(0)}, ${x3.toFixed(0)} ${y3.toFixed(0)}`;
  }

  function buildFlywheel(svg) {
    const rnd = lcg(20260716);
    svg.textContent = "";

    el("rect", { width: 1600, height: 900, fill: "#121710" }, svg);
    el("path", {
      d: "M1180 80 C1360 40 1520 120 1540 300 L1550 480 C1400 500 1290 450 1250 340 C1215 240 1200 160 1180 80 Z",
      fill: "#1B3423",
    }, svg);

    const buildings = el("g", { fill: "#1B211A" }, svg);
    for (let i = 0; i < 40; i++) {
      const w = 70 + rnd() * 130;
      const h = 60 + rnd() * 110;
      el("rect", {
        x: (rnd() * 1560).toFixed(0), y: (rnd() * 860).toFixed(0),
        width: w.toFixed(0), height: h.toFixed(0), rx: 8,
      }, buildings);
    }

    const hRoads = [180, 420, 660];
    const vRoads = [330, 700, 1080, 1400];
    const casing = el("g", { stroke: "#222B22", "stroke-width": 20, "stroke-linecap": "round", fill: "none" }, svg);
    const fills = el("g", { stroke: "#333E33", "stroke-width": 13, "stroke-linecap": "round", fill: "none" }, svg);
    for (const y of hRoads) {
      const d = `M-20 ${y} L1620 ${y - 10 + rnd() * 20}`;
      el("path", { d }, casing);
      el("path", { d }, fills);
    }
    for (const x of vRoads) {
      const d = `M${x} -20 L${x - 12 + rnd() * 24} 920`;
      el("path", { d }, casing);
      el("path", { d }, fills);
    }
    const minors = el("g", { stroke: "#2A342B", "stroke-width": 6, "stroke-linecap": "round", fill: "none", opacity: 0.9 }, svg);
    for (const y of [300, 540, 790]) el("path", { d: `M-20 ${y} L1620 ${y + (rnd() - 0.5) * 30}` }, minors);
    for (const x of [520, 900, 1250]) el("path", { d: `M${x} -20 L${x + (rnd() - 0.5) * 40} 920` }, minors);

    const labels = el("g", {
      "font-family": "IBM Plex Mono,monospace", "font-size": 15,
      fill: "#7E877E", "letter-spacing": "0.6",
    }, svg);
    el("text", { x: 520, y: 168 }, labels).textContent = "Samora Machel Ave";
    el("text", { x: 860, y: 408 }, labels).textContent = "Jason Moyo Ave";
    el("text", { transform: "translate(316,880) rotate(-90)" }, labels).textContent = "Julius Nyerere Way";
    el("text", { transform: "translate(1066,860) rotate(-90)" }, labels).textContent = "Chinhoyi St";
    el("text", { x: 1330, y: 300, fill: "#6F8F74" }, labels).textContent = "Harare Gardens";

    // Journey traces in three waves for the scrub beats.
    const waveSizes = [7, 10, 14];
    const waves = waveSizes.map((count) => {
      const g = el("g", {}, svg);
      const paths = [];
      for (let i = 0; i < count; i++) {
        const p = el("path", {
          d: tracePath(rnd),
          fill: "none",
          stroke: "#FFFFFF",
          "stroke-width": 3.5,
          "stroke-linecap": "round",
          opacity: (0.22 + rnd() * 0.3).toFixed(2),
        }, g);
        paths.push(p);
      }
      return paths;
    });

    // Shortcuts: marigold dashed threads between roads, wave three.
    const shortcuts = [];
    const scG = el("g", { filter: "drop-shadow(0 0 6px rgba(245,179,1,.45))" }, svg);
    for (let i = 0; i < 4; i++) {
      const x = 300 + rnd() * 1000;
      const y = 200 + rnd() * 500;
      const p = el("path", {
        d: `M${x} ${y} q ${40 + rnd() * 80} ${30 + rnd() * 60} ${120 + rnd() * 120} ${20 + rnd() * 80}`,
        fill: "none",
        stroke: "#F5B301",
        "stroke-width": 4,
        "stroke-linecap": "round",
        "stroke-dasharray": "1 13",
        opacity: 0.9,
      }, scG);
      shortcuts.push(p);
    }

    // Nickname chips, map place chip grammar. Names come from the plan
    // document, never invented.
    const chips = [];
    const chipDefs = [
      { x: 470, y: 640, name: "pa turn off" },
      { x: 1010, y: 380, name: "pamusika" },
    ];
    for (const c of chipDefs) {
      const g = el("g", { opacity: 0 }, svg);
      const w = c.name.length * 9.5 + 26;
      el("rect", {
        x: c.x - w / 2, y: c.y - 16, width: w, height: 32, rx: 16,
        fill: "#10150F", stroke: "rgba(255,255,255,.18)", "stroke-width": 1,
      }, g);
      const t = el("text", {
        x: c.x, y: c.y + 5, "text-anchor": "middle",
        "font-family": "IBM Plex Mono,monospace", "font-size": 15,
        "font-weight": 600, fill: "#FFFFFF",
      }, g);
      t.textContent = c.name;
      chips.push(g);
    }

    return { waves, shortcuts, chips };
  }

  window.SVK_ART = { buildFlywheel };
})();
