/* Service Worker mínimo para instalar la PWA y ofrecer fallback offline.
   No intercepta recursos de otros dominios ni modifica el editor. */
const CACHE_NAME = "editor-imagenes-pro-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("editor-imagenes-pro-shell-") && key !== CACHE_NAME)
            .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Solo solicitudes GET del mismo origen; no tocar Google Fonts/CDN ni otros servicios.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(request)) ||
                 (await cache.match("./index.html")) ||
                 Response.error();
        })
    );
    return;
  }

  // App shell local: cache-first. El resto de recursos same-origin usa red normal.
  const isShell = APP_SHELL.some(path => {
    const absolute = new URL(path, self.registration.scope).href;
    return url.href === absolute;
  });
  if (isShell) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
  }
});
