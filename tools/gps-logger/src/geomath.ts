// Pure geo + formatting helpers. No browser APIs here, so this module is fully
// unit-testable and safe to import from tests and the export builders.

import type { Fix, Ping } from "./types";

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in metres. */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Sum of segment distances along an ordered ping list, in metres. */
export function pathDistanceMeters(pings: readonly Ping[]): number {
  let total = 0;
  for (let i = 1; i < pings.length; i++) {
    const prev = pings[i - 1];
    const cur = pings[i];
    if (!prev || !cur) continue;
    total += haversineMeters(prev.lat, prev.lng, cur.lat, cur.lng);
  }
  return total;
}

/**
 * Best-effort speed in m/s for a fix. Uses the GPS-reported speed when present
 * (it is more accurate at low speed), otherwise derives it from the previous
 * fix. Returns null when neither is available.
 */
export function speedMps(fix: Fix, previous: Fix | null): number | null {
  if (fix.speed !== null && fix.speed >= 0) return fix.speed;
  if (!previous) return null;
  const dtSeconds = (fix.timestamp - previous.timestamp) / 1000;
  if (dtSeconds <= 0) return null;
  const meters = haversineMeters(previous.lat, previous.lng, fix.lat, fix.lng);
  return meters / dtSeconds;
}

export function mpsToKmh(mps: number | null): number | null {
  return mps === null ? null : mps * 3.6;
}

/** hh:mm:ss (drops the hours group under an hour). */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatKmh(mps: number | null): string {
  const kmh = mpsToKmh(mps);
  return kmh === null ? "--" : `${kmh.toFixed(kmh < 10 ? 1 : 0)} km/h`;
}
