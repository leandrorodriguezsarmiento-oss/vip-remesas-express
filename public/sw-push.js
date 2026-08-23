// Service worker dedicado a notificaciones push (Web Push).
// No cachea la app: solo escucha `push` y clicks.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "VIP Remesas", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "VIP Remesas";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192-v8.png",
    badge: data.badge || "/badge-crown-v8.png",
    data: { url: data.url || "/history" },
    tag: data.tag || "vip-remesas",
    renotify: true,
    // Suena y vibra según el volumen del sistema, aun con la pantalla apagada.
    silent: false,
    vibrate: [200, 100, 200, 100, 300],
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(targetUrl);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
