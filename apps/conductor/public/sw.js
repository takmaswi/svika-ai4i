// Placeholder service worker so the conductor app installs as a PWA. Real
// offline caching and the queued-redemption sync land in P2 (offline boarding);
// this only takes control so the install prompt works.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
