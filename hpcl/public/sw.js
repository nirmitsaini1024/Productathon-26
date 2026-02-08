/* Minimal service worker for installability.
 * - Pass-through fetch (network-first)
 * - No offline caching strategy (keeps behavior identical to current site)
 */

self.addEventListener("install", (event) => {
  // Activate immediately on install
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  // Take control of existing clients immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Keep default network behavior; just proxy the request.
  event.respondWith(fetch(event.request));
});


