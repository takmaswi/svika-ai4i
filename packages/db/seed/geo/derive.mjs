// Derives clean corridor geometry and a merged stop list from Mhofu's two real
// kombi rides on the Mount Pleasant Heights <-> Rezende corridor (recorded
// 2026-07-07 with the Svika field GPS logger). This is a reproducible
// derivation, not a hand transcription: re-run it whenever the raw rides change.
//
//   node packages/db/seed/geo/derive.mjs
//
// Inputs  (read only): assets/Takunda real kombi ride data/<journey>/*.pings.csv
//                      and *.points.csv
// Outputs (written):   packages/db/seed/geo/corridor.{route,stops,variance}.geojson
//                      packages/db/seed/geo/corridor.summary.json
//
// Rules honoured here:
//  - The CLEAN return run (Rezende -> Heights, no touting detours) is the base
//    road line. Both network directions are derived from it (inbound as
//    recorded, outbound as its reverse), so the corridor has one consistent
//    road shape.
//  - The detour-heavy inbound run (Heights -> Rezende, kombi sought customers)
//    is kept SEPARATELY as variance data. It never shapes the base line.
//  - Stops come only from the rider's marked points. Real names are preserved
//    exactly; nothing is invented. Blank-named markers are dropped from the
//    named stop list (kept only in the summary count).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");
const dataRoot = join(repoRoot, "assets", "Takunda real kombi ride data");

const RIDE_DATE = "2026-07-07";

// --- geomath (self contained; no dependency on the gps-logger package) -------

const EARTH_R = 6371008.8; // mean earth radius, metres

function toRad(d) {
  return (d * Math.PI) / 180;
}

// great circle distance in metres
function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// local equirectangular projection to metres around a reference latitude, so
// perpendicular distances for line simplification are in real metres
function projector(lat0) {
  const kx = (Math.cos(toRad(lat0)) * Math.PI * EARTH_R) / 180;
  const ky = (Math.PI * EARTH_R) / 180;
  return (p) => ({ x: p.lng * kx, y: p.lat * ky });
}

// perpendicular distance (metres) from point p to segment a-b
function perpDist(p, a, b, proj) {
  const P = proj(p);
  const A = proj(a);
  const B = proj(b);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(P.x - A.x, P.y - A.y);
  let t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = A.x + t * dx;
  const cy = A.y + t * dy;
  return Math.hypot(P.x - cx, P.y - cy);
}

// Ramer-Douglas-Peucker: keeps road shape, drops GPS jitter and dense points
function rdp(points, epsilon, proj) {
  if (points.length < 3) return points.slice();
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], points[0], points[points.length - 1], proj);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon, proj);
    const right = rdp(points.slice(index), epsilon, proj);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function polylineMetres(points) {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += haversine(points[i - 1], points[i]);
  return m;
}

// --- csv parsing -------------------------------------------------------------

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    header.forEach((h, i) => (row[h] = cols[i]));
    return row;
  });
}

function loadJourney(folder) {
  const dir = join(dataRoot, folder);
  const files = readdirSync(dir);
  const pingsFile = files.find((f) => f.endsWith(".pings.csv"));
  const pointsFile = files.find((f) => f.endsWith(".points.csv"));
  const pings = parseCsv(readFileSync(join(dir, pingsFile), "utf8")).map((r) => ({
    seq: Number(r.seq),
    mode: r.mode,
    lat: Number(r.lat),
    lng: Number(r.lng),
    accuracy_m: Number(r.accuracy_m),
    recorded_at: r.recorded_at,
  }));
  const points = parseCsv(readFileSync(join(dir, pointsFile), "utf8")).map((r) => ({
    marker_type: r.marker_type,
    name: (r.name ?? "").trim(),
    lat: Number(r.lat),
    lng: Number(r.lng),
    accuracy_m: Number(r.accuracy_m),
    recorded_at: r.recorded_at,
  }));
  return { folder, pings, points };
}

// --- clean a riding polyline -------------------------------------------------

const ACCURACY_MAX_M = 25; // drop pings the phone itself flagged as fuzzy
const DEDUPE_MIN_M = 2; // collapse stationary jitter at stops
const RDP_EPSILON_M = 6; // road-following tolerance, just above the ~5m GPS noise floor

function cleanRidingLine(pings) {
  const riding = pings
    .filter((p) => p.mode === "riding")
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .filter((p) => !Number.isFinite(p.accuracy_m) || p.accuracy_m <= ACCURACY_MAX_M)
    .sort((a, b) => a.seq - b.seq);
  const deduped = [];
  for (const p of riding) {
    const prev = deduped[deduped.length - 1];
    if (prev && haversine(prev, p) < DEDUPE_MIN_M) continue;
    deduped.push({ lat: p.lat, lng: p.lng });
  }
  const proj = projector(deduped[0]?.lat ?? 0);
  const smoothed = rdp(deduped, RDP_EPSILON_M, proj);
  return { raw: riding.length, kept: smoothed.length, line: smoothed };
}

function ridingMinutes(pings) {
  const riding = pings.filter((p) => p.mode === "riding");
  if (riding.length < 2) return null;
  const t0 = Date.parse(riding[0].recorded_at);
  const t1 = Date.parse(riding[riding.length - 1].recorded_at);
  return (t1 - t0) / 60000;
}

// --- merge the marked stops from both runs -----------------------------------

const MERGE_MAX_M = 150; // two markers this close MAY be the same stop
const STOPWORDS = new Set(["pa", "pama", "the", "shops", "shop", "rank", "st"]);

function tokens(name) {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t)),
  );
}

function shareToken(a, b) {
  for (const t of tokens(a)) if (tokens(b).has(t)) return true;
  return false;
}

// Same stop only when close AND names share a distinctive token. This keeps
// distinct-but-near landmarks apart (First vs 2nd boom gate ~250m; Pama Church
// vs Pama Broom, different names) while merging cross-run duplicates
// (Ashbrittle / Ashbrittle shops; Pa Police-Pamapurisa / Malborough Police).
function mergeStops(namedMarkers) {
  const clusters = [];
  for (const m of namedMarkers) {
    const hit = clusters.find((c) =>
      c.members.some((x) => haversine(x, m) <= MERGE_MAX_M && shareToken(x.name, m.name)),
    );
    if (hit) hit.members.push(m);
    else clusters.push({ members: [m] });
  }
  return clusters.map((c) => {
    // representative coordinate = the observation with the best accuracy
    const best = c.members.slice().sort((a, b) => a.accuracy_m - b.accuracy_m)[0];
    // canonical name = the longest real name across observations (fullest form)
    const names = c.members.map((m) => m.name);
    const primary = names.slice().sort((a, b) => b.length - a.length)[0];
    const aliases = [...new Set(names)].filter((n) => n !== primary);
    const isRank = c.members.some((m) => m.marker_type === "rank");
    return {
      name: primary,
      aliases,
      lat: best.lat,
      lng: best.lng,
      accuracy_m: best.accuracy_m,
      marker_type: isRank ? "rank" : c.members[0].marker_type,
      observations: c.members.length,
      sources: [...new Set(c.members.map((m) => m.source))],
    };
  });
}

// distance of a point projected onto its nearest span of an oriented line;
// used to order the merged stops along the real road (robust to lat wiggle)
function alongDistance(pt, line, proj) {
  let cum = 0;
  let best = Infinity;
  let bestCum = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const d = perpDist(pt, a, b, proj);
    if (d < best) {
      best = d;
      bestCum = cum + haversine(a, pt); // approx offset into this span
    }
    cum += haversine(a, b);
  }
  return bestCum;
}

// --- geojson helpers ---------------------------------------------------------

const lineFeature = (line, props) => ({
  type: "Feature",
  properties: props,
  geometry: { type: "LineString", coordinates: line.map((p) => [p.lng, p.lat]) },
});
const pointFeature = (p, props) => ({
  type: "Feature",
  properties: props,
  geometry: { type: "Point", coordinates: [p.lng, p.lat] },
});
const fc = (features) => ({ type: "FeatureCollection", features });

// --- run ---------------------------------------------------------------------

const inbound = loadJourney("Mount Pleasant Heights to Rezende"); // touting detours
const outboundClean = loadJourney("Rezende to Mount Pleasant Heights"); // clean base

// tag sources for provenance
inbound.points.forEach((p) => (p.source = "inbound_run"));
outboundClean.points.forEach((p) => (p.source = "return_run"));

// base road line comes from the CLEAN return run (Rezende -> Heights)
const base = cleanRidingLine(outboundClean.pings);
const variance = cleanRidingLine(inbound.pings);

// network directions from the one clean base:
//   inbound  (Rezende -> Heights) = base as recorded
//   outbound (Heights -> Rezende) = base reversed
const baseRezendeToHeights = base.line;
const baseHeightsToRezende = base.line.slice().reverse();

const returnMin = ridingMinutes(outboundClean.pings);
const inboundMin = ridingMinutes(inbound.pings);

// merge stops
const namedMarkers = [...inbound.points, ...outboundClean.points].filter(
  (m) => m.name.length > 0,
);
const blankMarkers =
  inbound.points.length +
  outboundClean.points.length -
  namedMarkers.length;

const merged = mergeStops(namedMarkers);

// order Heights (north) -> Rezende (south) along the real base road
const proj = projector(baseHeightsToRezende[0].lat);
merged.forEach((s) => (s._along = alongDistance(s, baseHeightsToRezende, proj)));
merged.sort((a, b) => a._along - b._along);
merged.forEach((s, i) => {
  s.order = i;
  delete s._along;
});

// --- write outputs -----------------------------------------------------------

writeFileSync(
  join(here, "corridor.route.geojson"),
  JSON.stringify(
    fc([
      lineFeature(baseHeightsToRezende, {
        route_code: "HEIGHTS-REZENDE",
        direction: "outbound",
        role: "canonical_base",
        derived_from: "clean return run reversed",
        length_m: Math.round(polylineMetres(baseHeightsToRezende)),
      }),
      lineFeature(baseRezendeToHeights, {
        route_code: "HEIGHTS-REZENDE",
        direction: "inbound",
        role: "canonical_base",
        derived_from: "clean return run as recorded",
        length_m: Math.round(polylineMetres(baseRezendeToHeights)),
      }),
    ]),
    null,
    2,
  ) + "\n",
);

writeFileSync(
  join(here, "corridor.stops.geojson"),
  JSON.stringify(
    fc(
      merged.map((s) =>
        pointFeature(s, {
          name: s.name,
          aliases: s.aliases,
          order: s.order,
          marker_type: s.marker_type,
          observations: s.observations,
          sources: s.sources,
          accuracy_m: s.accuracy_m,
        }),
      ),
    ),
    null,
    2,
  ) + "\n",
);

writeFileSync(
  join(here, "corridor.variance.geojson"),
  JSON.stringify(
    fc([
      lineFeature(variance.line, {
        route_code: "HEIGHTS-REZENDE",
        role: "variance",
        derived_from: "inbound run (Heights -> Rezende) with customer-seeking detours",
        note: "kept for ETA/variance work only; does NOT shape the base route",
        length_m: Math.round(polylineMetres(variance.line)),
      }),
    ]),
    null,
    2,
  ) + "\n",
);

const summary = {
  corridor: "Mount Pleasant Heights <-> Rezende",
  ride_date: RIDE_DATE,
  provenance:
    "Derived from a single real kombi ride per direction, recorded 2026-07-07 with the Svika field GPS logger. Real data, not synthetic. More runs will refine the geometry and stop set.",
  base_line: {
    source: "clean return run (Rezende -> Heights, no touting detours)",
    raw_riding_pings: base.raw,
    smoothed_vertices: base.kept,
    length_m: Math.round(polylineMetres(base.line)),
    clean_riding_minutes: returnMin != null ? Math.round(returnMin) : null,
  },
  variance_line: {
    source: "inbound run (Heights -> Rezende, customer-seeking detours)",
    raw_riding_pings: variance.raw,
    smoothed_vertices: variance.kept,
    length_m: Math.round(polylineMetres(variance.line)),
    riding_minutes: inboundMin != null ? Math.round(inboundMin) : null,
  },
  blank_named_markers_dropped: blankMarkers,
  stop_count: merged.length,
  stops: merged.map((s) => ({
    order: s.order,
    name: s.name,
    aliases: s.aliases,
    lat: s.lat,
    lng: s.lng,
    marker_type: s.marker_type,
    observations: s.observations,
    sources: s.sources,
  })),
};

writeFileSync(
  join(here, "corridor.summary.json"),
  JSON.stringify(summary, null, 2) + "\n",
);

// --- report ------------------------------------------------------------------

console.log(`base road (clean return): ${base.raw} riding pings -> ${base.kept} vertices, ${summary.base_line.length_m} m, ~${summary.base_line.clean_riding_minutes} min`);
console.log(`variance (touty inbound): ${variance.raw} riding pings -> ${variance.kept} vertices, ${summary.variance_line.length_m} m, ~${summary.variance_line.riding_minutes} min`);
console.log(`blank-named markers dropped: ${blankMarkers}`);
console.log(`\nmerged corridor stops (Heights -> Rezende), ${merged.length} total:`);
for (const s of merged) {
  const al = s.aliases.length ? `  [aka ${s.aliases.join(", ")}]` : "";
  const rk = s.marker_type === "rank" ? " (RANK)" : "";
  console.log(
    `  ${String(s.order).padStart(2)}  ${s.name}${rk}  (${s.lat.toFixed(6)}, ${s.lng.toFixed(6)})  x${s.observations}${al}`,
  );
}
