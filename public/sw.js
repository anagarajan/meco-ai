// __BUILD_TIMESTAMP__ is replaced with a unix timestamp at build time by the
// Vite stamp-sw plugin. This makes the SW file byte-different on every deploy,
// so the browser detects the update automatically.
const CACHE_NAME = "meco-ai-__BUILD_TIMESTAMP__";

const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-maskable-512.svg",
  "/icons/apple-touch-icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  // Do NOT call skipWaiting() here. The app controls activation via SKIP_WAITING
  // so the user sees the "Update available" banner before the page reloads.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

// App posts { type: "SKIP_WAITING" } when the user taps "Update now".
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Navigation requests (HTML) — network first so the app always loads the
  // latest index.html on open. Falls back to cached shell if offline.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/")),
    );
    return;
  }

  // Static assets (JS/CSS/icons) — cache first. Vite content-hashes these
  // filenames so stale entries are never served for updated code.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match("/"));
    }),
  );
});
