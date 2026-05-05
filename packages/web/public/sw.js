// Squadquarium service worker — v0 affordance (not a polished offline experience)
const CACHE_NAME = "squadquarium-v1";
const PRECACHE = [
  "/",
  "/fonts/JetBrainsMono-Regular.woff2",
  "/skins/aquarium/manifest.json",
  "/skins/aquarium/tokens.css",
  "/skins/office/manifest.json",
  "/skins/office/tokens.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE.filter(Boolean)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/skins/") || url.pathname.startsWith("/fonts/")) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ??
          fetch(event.request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
            }
            return res;
          }),
      ),
    );
  }
});
