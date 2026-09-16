const CACHE_NAME = "vip-remesas-static-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Passthrough service worker: keeps the app's SSR/API/auth requests untouched
  // while satisfying browser PWA installability requirements.
  event.respondWith(fetch(event.request));
});
