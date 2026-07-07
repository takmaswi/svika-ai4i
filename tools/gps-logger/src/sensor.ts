// Browser sensor wrappers: high-accuracy location watching and the screen Wake
// Lock. Kept apart from the pure math so the rest of the app (and the tests)
// need not touch navigator.

import type { Fix } from "./types";

export interface LocationWatcher {
  stop: () => void;
}

function toFix(pos: GeolocationPosition): Fix {
  const c = pos.coords;
  return {
    timestamp: pos.timestamp,
    lat: c.latitude,
    lng: c.longitude,
    accuracy: Number.isFinite(c.accuracy) ? c.accuracy : null,
    speed: c.speed !== null && Number.isFinite(c.speed) ? c.speed : null,
    heading: c.heading !== null && Number.isFinite(c.heading) ? c.heading : null,
    altitude:
      c.altitude !== null && Number.isFinite(c.altitude) ? c.altitude : null,
  };
}

/**
 * Start high-accuracy position watching. Every fix is delivered to onFix; the
 * caller is responsible for persisting it immediately. Returns a handle to stop
 * the watch. Throws if geolocation is unavailable.
 */
export function watchLocation(
  onFix: (fix: Fix) => void,
  onError: (message: string) => void,
): LocationWatcher {
  if (!("geolocation" in navigator)) {
    throw new Error("This device has no geolocation.");
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onFix(toFix(pos)),
    (err) => onError(err.message || "Location error"),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
  );
  return {
    stop: () => navigator.geolocation.clearWatch(id),
  };
}

// Keeps the screen awake for the length of a journey. The lock is dropped by the
// browser whenever the page is hidden, so we re-acquire it when the page becomes
// visible again. Silently degrades on browsers without the API.
export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;
  private readonly onVisibility = () => {
    if (this.wanted && document.visibilityState === "visible") {
      void this.acquire();
    }
  };

  async request(): Promise<void> {
    this.wanted = true;
    document.addEventListener("visibilitychange", this.onVisibility);
    await this.acquire();
  }

  async release(): Promise<void> {
    this.wanted = false;
    document.removeEventListener("visibilitychange", this.onVisibility);
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch {
        // already released by the browser; nothing to do
      }
      this.sentinel = null;
    }
  }

  get supported(): boolean {
    return "wakeLock" in navigator;
  }

  private async acquire(): Promise<void> {
    if (!this.supported || this.sentinel) return;
    try {
      this.sentinel = await navigator.wakeLock.request("screen");
      this.sentinel.addEventListener("release", () => {
        this.sentinel = null;
      });
    } catch {
      // permission denied or not allowed in this context; keep logging anyway
      this.sentinel = null;
    }
  }
}
