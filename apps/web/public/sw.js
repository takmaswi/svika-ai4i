// Svika map tile cache. This worker exists for one job: cache the corridor's
// MapTiler tiles and style so the live map loads fast on a cheap Android and
// repeat views do not spend the MapTiler quota again. It never touches
// anything else. Supabase calls, app pages, _next assets and every non
// MapTiler request are left entirely to the network, matching the conductor
// PWA's rule that offline behaviour is explicit app logic, never a stale HTTP
// cache of the API.
const CACHE = "svika-maptiler-v1";
const TILE_HOST = "api.maptiler.com";
const MAX_ENTRIES = 500; // the corridor is a small bbox; this is a safety cap

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("svika-maptiler") && n !== CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  // simple FIFO: drop the oldest overflow so the cache stays bounded
  await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  // Only MapTiler. Everything else is none of this worker's business.
  if (url.hostname !== TILE_HOST) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        // cache only real, cacheable responses (skip errors and opaque 0s)
        if (res && res.ok && res.status === 200) {
          cache.put(req, res.clone()).then(() => trim(cache)).catch(() => {});
        }
        return res;
      } catch (err) {
        // offline and never fetched: let the map handle the gap
        const fallback = await cache.match(req);
        if (fallback) return fallback;
        throw err;
      }
    })(),
  );
});
