/* FRT-VMS service worker — installability + static asset caching + update flow.
   Dynamic pages and API/Supabase/GPS calls always go to the network (never cached),
   so authed data is never stale.

   To push an update to everyone who already installed the PWA: bump VERSION.
   Changing this file's bytes makes the browser detect a new worker, which then
   waits and the app shows an "Update available" prompt (see ServiceWorkerRegistrar). */
const VERSION = "v2";
const CACHE = `frtvms-static-${VERSION}`;
const PRECACHE = [
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon-32.png",
];

self.addEventListener("install", (event) => {
  // Intentionally NO skipWaiting() here: the new worker waits so the app can
  // show an update prompt. It activates on demand via the SKIP_WAITING message.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page posts this when the user accepts the "Update available" prompt.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only handle our own origin; leave Supabase / GPS APIs untouched.
  if (url.origin !== self.location.origin) return;

  // Cache-first for immutable build assets + our icons.
  if (url.pathname.startsWith("/_next/static/") || PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Navigations: network-first, fall back to a cached shell asset only when truly offline.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
  }
  // Everything else: default network behaviour (no SW interference).
});
