/// <reference lib="webworker" />
export {};
declare const self: ServiceWorkerGlobalScope;

/**
 * Offline-first service worker for Speedometer PWA.
 * Follows redirects and caches the final target, never a redirected response.
 * When a redirect occurs, the final response is cached under BOTH:
 * - the original request URL, and
 * - the final URL after redirects (if same-origin).
 */

const CACHE_VERSION = "0.0.58";
const CACHE_NAME = `speedometer-${CACHE_VERSION}`;

const ASSETS: string[] = [
  "/",
  "/index.html",
  // app is bundled by Vite; keep index.html precached, assets are handled at runtime
  "/manifest.webmanifest",
  "/icons/generated/icon-192.png",
  "/icons/generated/icon-512.png",
];

/**
 * Helpers
 */
const isSameOrigin = (url: string): boolean => {
  try {
    return new URL(url, self.location.href).origin === self.location.origin;
  } catch {
    return false;
  }
};

async function putUnderBothUrls(
  cache: Cache,
  originalRequest: Request,
  finalUrl: string | null,
  response: Response,
): Promise<void> {
  // Cache under the original request key
  await cache.put(originalRequest, response.clone());

  // Also cache under the final URL (if same-origin), to avoid re-fetching later by its canonical URL
  if (finalUrl && isSameOrigin(finalUrl)) {
    const finalRequest = new Request(finalUrl, { method: "GET" });
    await cache.put(finalRequest, response.clone());
  }
}

/**
 * Given a GET Request, fetch it from network and:
 * - If a redirect happened, fetch the final URL and cache THAT response (under both original and final URLs).
 * - Otherwise, cache the network response normally.
 * Returns the response to serve.
 */
async function fetchFollowAndCacheGET(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);

  // Initial network fetch (default behavior follows redirects)
  const networkResponse = await fetch(request);

  // For non-GET, opaque, or non-OK responses, just return without caching
  if (request.method !== "GET") {
    return networkResponse;
  }

  // If the request resulted in a redirect, fetch the final URL explicitly to obtain a non-redirected response
  if (networkResponse.redirected) {
    const finalUrl = networkResponse.url;
    const finalResponse = await fetch(finalUrl, { method: "GET" });

    if (finalResponse.ok && finalResponse.type === "basic") {
      await putUnderBothUrls(cache, request, finalUrl, finalResponse.clone());
    }
    return finalResponse;
  }

  // Normal successful same-origin responses are type "basic"
  if (networkResponse.ok && networkResponse.type === "basic") {
    // Cache under the original request
    await cache.put(request, networkResponse.clone());

    // If the network URL differs (e.g., normalized path), also store under that URL
    const networkUrl = networkResponse.url;
    if (networkUrl && networkUrl !== request.url && isSameOrigin(networkUrl)) {
      const finalRequest = new Request(networkUrl, { method: "GET" });
      await cache.put(finalRequest, networkResponse.clone());
    }
  }

  return networkResponse;
}

/**
 * Precache assets, following redirects and caching only final responses.
 */
self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Manually fetch and cache assets to ensure we never store redirected responses
      for (const url of ASSETS) {
        try {
          const req = new Request(url, { method: "GET" });
          const resp = await fetch(req);
          if (resp.redirected) {
            const finalResp = await fetch(resp.url, { method: "GET" });
            if (finalResp.ok && finalResp.type === "basic") {
              await putUnderBothUrls(cache, req, resp.url, finalResp.clone());
            }
          } else if (resp.ok && resp.type === "basic") {
            await cache.put(req, resp.clone());
          }
        } catch {
          // Ignore individual asset failures during install; runtime fetch handler will recover.
        }
      }
      // Activate worker immediately after successful precache
      self.skipWaiting();
    })(),
  );
});

/**
 * On activate, purge old caches.
 */
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

/**
 * Fetch handler:
 * - Handle same-origin requests only.
 * - Navigation: network-first, follow redirects; fallback to cached index.html when offline.
 * - Other GETs: cache-first; on miss or redirected cache entry, fetch (follow redirects) and cache final response.
 */
self.addEventListener("fetch", (event: FetchEvent) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests: try network first, following redirects; fallback to cached index.html when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // Use the same logic to ensure we never cache redirected responses
          const response = await fetchFollowAndCacheGET(request);
          return response;
        } catch {
          const cachedIndex = await caches.match("/index.html");
          if (cachedIndex && !cachedIndex.redirected) {
            return cachedIndex;
          }
          return new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  // For non-GET requests, just pass-through
  if (request.method !== "GET") {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets and other GET requests: cache-first, then network (following redirects) and cache the final target
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      // If we previously stored a redirected response by mistake, don't serve it; fetch fresh instead.
      if (cached && !cached.redirected) {
        return cached;
      }

      try {
        const networkResponse = await fetchFollowAndCacheGET(request);
        return networkResponse;
      } catch {
        // As a last resort for known assets, serve from cache if available
        if (ASSETS.includes(url.pathname)) {
          const fallback = await caches.match(request);
          if (fallback && !fallback.redirected) {
            return fallback;
          }
        }
        return new Response("Offline", { status: 503 });
      }
    })(),
  );
});
