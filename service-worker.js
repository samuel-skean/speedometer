/**
 * Offline-first service worker for Speedometer PWA.
 * Caches the app shell and serves cached responses when offline,
 * with a navigation fallback to index.html.
 */

const CACHE_VERSION = "0.0.11";
const CACHE_NAME = `speedometer-${CACHE_VERSION}`;

const ASSETS = [
  "/index.html",
  "/app.js",
  "/manifest.webmanifest",
  "/icons/generated/icon-192.png",
  "/icons/generated/icon-512.png",
];

/**
 * On install, pre-cache core assets.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

/**
 * On activate, purge old caches.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

/**
 * Fetch handler:
 * - Try cache first for same-origin requests; fall back to network.
 * - For navigation requests, fall back to cached index.html when offline.
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests: offline fallback to index.html
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // Try network first for navigations (to keep fresh)
          const networkResponse = await fetch(request);
          // iOS Safari: avoid serving redirected responses from SW
          if (networkResponse.redirected) {
            const finalResp = await fetch(networkResponse.url, { method: "GET" });
            return finalResp;
          }
          // Optionally cache successful navigations (not strictly necessary)
          return networkResponse;
        } catch {
          // Offline fallback
          const cachedIndex = await caches.match("/index.html");
          // iOS Safari: avoid serving redirected responses from SW
          if (cachedIndex && !cachedIndex.redirected) {
            return cachedIndex;
          }
          return new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  // Static assets and other requests: cache-first, then network
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached && !cached.redirected) return cached;

      try {
        const networkResponse = await fetch(request);
        // Cache a copy of successful GET responses (only 200/basic and non-redirected)
        if (
          request.method === "GET" &&
          networkResponse.ok &&
          networkResponse.status === 200 &&
          networkResponse.type === "basic" &&
          !networkResponse.redirected
        ) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        // As a last resort, if the request was for an asset we know, serve it from cache
        if (ASSETS.includes(url.pathname)) {
          const fallback = await caches.match(request);
          if (fallback && !fallback.redirected) return fallback;
        }
        return new Response("Offline", { status: 503 });
      }
    })(),
  );
});
