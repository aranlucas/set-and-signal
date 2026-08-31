/* Runtime service worker: Web Push plus cache-first exercise media and network-first app assets. */
const CACHE = "set-and-signal-rt-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        const deletions = [];
        for (const cacheName of cacheNames) {
          if (cacheName !== CACHE) deletions.push(caches.delete(cacheName));
        }
        return Promise.all(deletions);
      })
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("push", (event) => {
  let notification = {};
  try {
    notification = event.data ? event.data.json() : {};
  } catch {
    notification = { body: event.data?.text() || "" };
  }
  event.waitUntil(
    self.registration.showNotification(notification.title || "Set & Signal", {
      body: notification.body || "",
      icon: "icon-512.png",
      badge: "icon-180.png",
      tag: notification.tag || "set-and-signal",
      renotify: true,
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windowClients) => {
      const appWindow = windowClients.find((client) => "focus" in client);
      return appWindow ? appWindow.focus() : self.clients.openWindow("./");
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache auth/data

  const isMedia = url.pathname.includes("/img/") || url.pathname.includes("/gif/");
  if (isMedia) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(event.request).then(
          (cachedResponse) =>
            cachedResponse ||
            fetch(event.request).then((response) => {
              return response.ok
                ? cache.put(event.request, response.clone()).then(() => response)
                : response;
            }),
        ),
      ),
    );
  } else {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          return response.ok
            ? caches
                .open(CACHE)
                .then((cache) => cache.put(event.request, response.clone()))
                .then(() => response)
            : response;
        })
        .catch(() =>
          caches.match(event.request).then((cachedResponse) => cachedResponse || caches.match("/")),
        ),
    );
  }
});
