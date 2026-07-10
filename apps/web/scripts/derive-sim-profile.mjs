// Derives the simulated fleet's movement profiles from the two real corridor
// rides recorded 2026-07-07 (assets/Takunda real kombi ride data). For each
// direction the riding-leg GPS pings are snapped onto the canonical base line
// and become a monotone time -> metres curve, so the map's kombis speed up,
// slow down and pause exactly where the real kombi did. The return leg keeps
// its own times (the outbound ride took ~43 riding minutes with touting, the
// return ~27 clean minutes), per Mhofu's check answer: same road both ways,
// each direction with its own segment times.
//
// Usage: node scripts/derive-sim-profile.mjs   (from apps/web)
// Output: src/lib/map/sim-profile.json (committed; regenerate when new rides land)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const ridesDir = join(repoRoot, "assets", "Takunda real kombi ride data");

const BUNDLES = {
  // outbound = Heights -> Rezende (route code order), the touting ride
  outbound: join(
    ridesDir,
    "Mount Pleasant Heights to Rezende",
    "20260707-1254_journey_2026_07_07_12_54_ij0hz8.bundle.json",
  ),
  // inbound = Rezende -> Heights, the clean return run the base line came from
  inbound: join(
    ridesDir,
    "Rezende to Mount Pleasant Heights",
    "20260707-1512_journey_2026_07_07_15_12_47ni9q.bundle.json",
  ),
};

/** Sample the curve every this many seconds; short real stops survive. */
const SAMPLE_SECONDS = 15;
/** A kombi this close to a rank still counts as parked there. */
const RANK_RADIUS_M = 60;

// --- base line ---------------------------------------------------------------
const route = JSON.parse(
  readFileSync(join(repoRoot, "packages", "db", "seed", "geo", "corridor.route.geojson"), "utf8"),
);
const outboundLine = route.features.find((f) => f.properties.direction === "outbound");
if (!outboundLine) throw new Error("corridor export has no outbound line");
const line = outboundLine.geometry.coordinates;

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function meters(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const cumulative = [0];
for (let i = 1; i < line.length; i++) {
  cumulative.push(cumulative[i - 1] + meters(line[i - 1], line[i]));
}
const totalMeters = cumulative[cumulative.length - 1];

/** Metres along the line of the closest point on any segment (planar projection
 *  in a locally scaled lng/lat frame; exact enough at city scale). */
function snapMeters(p) {
  const latScale = Math.cos(rad(p[1]));
  let best = Infinity;
  let at = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const ax = (a[0] - p[0]) * latScale;
    const ay = a[1] - p[1];
    const bx = (b[0] - p[0]) * latScale;
    const by = b[1] - p[1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2));
    const px = ax + dx * t;
    const py = ay + dy * t;
    const d2 = px * px + py * py;
    if (d2 < best) {
      best = d2;
      at = cumulative[i] + (cumulative[i + 1] - cumulative[i]) * t;
    }
  }
  return at;
}

// --- per-direction profile -----------------------------------------------------
function deriveProfile(direction, bundlePath) {
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  const riding = bundle.legs.find((l) => l.mode === "riding");
  if (!riding) throw new Error(`${direction}: bundle has no riding leg`);
  const pings = bundle.gps_pings
    .filter((p) => p.leg_index === riding.index && p.mode === "riding")
    .sort((a, b) => a.seq - b.seq);

  // snap, timestamp, then clamp monotone in the direction of travel
  const t0 = Date.parse(pings[0].recorded_at);
  const raw = pings.map((p) => ({
    s: (Date.parse(p.recorded_at) - t0) / 1000,
    m: snapMeters([p.lng, p.lat]),
  }));
  const sign = direction === "outbound" ? 1 : -1;
  let run = raw[0].m;
  const mono = raw.map(({ s, m }) => {
    run = sign > 0 ? Math.max(run, m) : Math.min(run, m);
    return { s, m: run };
  });

  // trim idle at the departure rank: start at the last sample still inside the
  // rank radius, so loading time at the rank does not read as a parked marker
  const start = mono[0].m;
  const end = mono[mono.length - 1].m;
  let from = 0;
  for (let i = 0; i < mono.length; i++) {
    if (Math.abs(mono[i].m - start) <= RANK_RADIUS_M / 4) from = i;
    if (Math.abs(mono[i].m - start) > RANK_RADIUS_M) break;
  }
  let to = mono.length - 1;
  for (let i = mono.length - 1; i >= 0; i--) {
    if (Math.abs(mono[i].m - end) <= RANK_RADIUS_M / 4) to = i;
    if (Math.abs(mono[i].m - end) > RANK_RADIUS_M) break;
  }
  const window = mono.slice(from, to + 1);
  const tStart = window[0].s;
  const duration = window[window.length - 1].s - tStart;

  // stretch the covered stretch onto the full base line (the ride's first and
  // last snap sit a few metres inside the ranks); at most a ~1% scale
  const covered = Math.abs(window[window.length - 1].m - window[0].m);
  const scale = totalMeters / covered;
  const origin = window[0].m;
  const toLineMeters = (m) => {
    const along = Math.abs(m - origin) * scale;
    return direction === "outbound" ? along : totalMeters - along;
  };

  // resample onto a fixed grid so the committed file stays small
  const points = [];
  let j = 0;
  for (let s = 0; s <= duration; s += SAMPLE_SECONDS) {
    const target = tStart + s;
    while (j < window.length - 1 && window[j + 1].s <= target) j++;
    const a = window[j];
    const b = window[Math.min(j + 1, window.length - 1)];
    const f = b.s === a.s ? 0 : (target - a.s) / (b.s - a.s);
    const m = a.m + (b.m - a.m) * Math.min(1, Math.max(0, f));
    points.push([Math.round(s), Math.round(toLineMeters(m))]);
  }
  const last = window[window.length - 1];
  points.push([Math.round(duration), Math.round(toLineMeters(last.m))]);
  // exact endpoints so a kombi departs from and arrives at the rank dot
  points[0][1] = direction === "outbound" ? 0 : Math.round(totalMeters);
  points[points.length - 1][1] = direction === "outbound" ? Math.round(totalMeters) : 0;

  return {
    sourceBundle: bundlePath.slice(repoRoot.length + 1).replaceAll("\\", "/"),
    ridingPings: pings.length,
    trimmedIdleSeconds: Math.round(tStart + (mono[mono.length - 1].s - window[window.length - 1].s)),
    durationSeconds: Math.round(duration),
    points,
  };
}

const profiles = {
  outbound: deriveProfile("outbound", BUNDLES.outbound),
  inbound: deriveProfile("inbound", BUNDLES.inbound),
};

const out = {
  routeCode: outboundLine.properties.route_code,
  provenance:
    "Time vs distance curves of the two real corridor rides recorded 2026-07-07, riding legs only, snapped to the canonical base line. Real field data, not synthetic. Regenerate with: node apps/web/scripts/derive-sim-profile.mjs",
  baseLineMeters: Math.round(totalMeters),
  sampleSeconds: SAMPLE_SECONDS,
  generatedAt: new Date().toISOString(),
  directions: profiles,
};

const target = join(here, "..", "src", "lib", "map", "sim-profile.json");
writeFileSync(target, JSON.stringify(out) + "\n");

for (const [dir, p] of Object.entries(profiles)) {
  const mins = (p.durationSeconds / 60).toFixed(1);
  console.log(
    `${dir}: ${p.ridingPings} riding pings -> ${p.points.length} checkpoints, ` +
      `${mins} riding minutes, ${p.trimmedIdleSeconds}s rank idle trimmed`,
  );
}
console.log(`wrote ${target}`);
