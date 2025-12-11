/**
 * Offline-first service worker for Speedometer PWA.
 * Caches the app shell and serves cached responses when offline,
 * with a navigation fallback to index.html.
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = `speedometer-${CACHE_VERSION}`;

const ASSETS = [
	"/",
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
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
	);
	self.skipWaiting();
});

/**
 * On activate, purge old caches.
 */
self.addEventListener("activate", (event) => {
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
					// Optionally cache successful navigations (not strictly necessary)
					return networkResponse;
				} catch {
					// Offline fallback
					const cachedIndex = await caches.match("/index.html");
					return cachedIndex || new Response("Offline", { status: 503 });
				}
			})(),
		);
		return;
	}

	// Static assets and other requests: cache-first, then network
	event.respondWith(
		(async () => {
			const cached = await caches.match(request);
			if (cached) return cached;

			try {
				const networkResponse = await fetch(request);
				// Cache a copy of successful GET responses
				if (request.method === "GET" && networkResponse.ok) {
					const cache = await caches.open(CACHE_NAME);
					cache.put(request, networkResponse.clone());
				}
				return networkResponse;
			} catch {
				// As a last resort, if the request was for an asset we know, serve it from cache
				if (ASSETS.includes(url.pathname)) {
					const fallback = await caches.match(request);
					if (fallback) return fallback;
				}
				return new Response("Offline", { status: 503 });
			}
		})(),
	);
});
