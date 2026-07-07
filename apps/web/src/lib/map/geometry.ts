// Pure polyline math for the live map. Positions along the real corridor are
// expressed as metres from the line's start; these helpers turn that into a
// lng/lat and a heading the kombi marker can rotate to (degrees clockwise
// from north, matching the marker's "front points up at 0" spec).
// Non-null assertions below all ride on the constructor invariant:
// coordinates.length >= 2 and cumulative.length === coordinates.length.

export type LngLat = [number, number];

export interface PolylineMetrics {
  coordinates: LngLat[];
  /** cumulative[i] = metres from the start to vertex i; cumulative[0] = 0 */
  cumulative: number[];
  totalMeters: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

function haversineMeters(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function measurePolyline(coordinates: LngLat[]): PolylineMetrics {
  if (coordinates.length < 2) {
    throw new Error("a polyline needs at least two points");
  }
  const cumulative = [0];
  for (let i = 1; i < coordinates.length; i++) {
    cumulative.push(
      cumulative[i - 1]! + haversineMeters(coordinates[i - 1]!, coordinates[i]!),
    );
  }
  return {
    coordinates,
    cumulative,
    totalMeters: cumulative[cumulative.length - 1]!,
  };
}

/** Index of the segment that contains the (clamped) distance. */
function segmentAt(metrics: PolylineMetrics, meters: number): number {
  const { cumulative } = metrics;
  const last = cumulative.length - 2;
  if (meters <= 0) return 0;
  if (meters >= metrics.totalMeters) return last;
  let lo = 0;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cumulative[mid]! <= meters) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function pointAtDistance(metrics: PolylineMetrics, meters: number): LngLat {
  const { coordinates, cumulative, totalMeters } = metrics;
  if (meters <= 0) return coordinates[0]!;
  if (meters >= totalMeters) return coordinates[coordinates.length - 1]!;
  const i = segmentAt(metrics, meters);
  const segLen = cumulative[i + 1]! - cumulative[i]!;
  if (segLen === 0) return coordinates[i]!;
  const f = (meters - cumulative[i]!) / segLen;
  const [ax, ay] = coordinates[i]!;
  const [bx, by] = coordinates[i + 1]!;
  return [ax + (bx - ax) * f, ay + (by - ay) * f];
}

/** Initial bearing of the segment under the distance, degrees clockwise from north. */
export function headingAtDistance(metrics: PolylineMetrics, meters: number): number {
  const i = segmentAt(metrics, meters);
  const a = metrics.coordinates[i]!;
  const b = metrics.coordinates[i + 1]!;
  const dLng = toRad(b[0] - a[0]);
  const latA = toRad(a[1]);
  const latB = toRad(b[1]);
  const y = Math.sin(dLng) * Math.cos(latB);
  const x =
    Math.cos(latA) * Math.sin(latB) -
    Math.sin(latA) * Math.cos(latB) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}
