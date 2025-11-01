// Service Worker for Claude Chat PWA
// Provides offline caching and update notifications

const CACHE_NAME = "claude-chat-v1";
const RUNTIME_CACHE = "claude-chat-runtime";

// Assets to cache on install
const PRECACHE_URLS = [
  "/",
  "/icon-180.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

// Install event - cache essential assets
self.addEventListener("install", (event) => {
  console.log("[SW] Install event");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Pre-caching assets");
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log("[SW] Skip waiting");
        return self.skipWaiting();
      }),
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activate event");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Delete old caches that don't match current version
              return (
                name !== CACHE_NAME &&
                name !== RUNTIME_CACHE
              );
            })
            .map((name) => {
              console.log("[SW] Deleting old cache:", name);
              return caches.delete(name);
            }),
        );
      })
      .then(() => {
        console.log("[SW] Claiming clients");
        return self.clients.claim();
      }),
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip WebSocket and API requests
  if (
    url.pathname.startsWith("/ws") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        console.log("[SW] Serving from cache:", url.pathname);
        return cachedResponse;
      }

      console.log("[SW] Fetching from network:", url.pathname);
      return fetch(request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        // Cache static assets in runtime cache
        if (
          url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff|woff2)$/)
        ) {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            console.log("[SW] Caching runtime asset:", url.pathname);
            cache.put(request, responseToCache);
          });
        }

        return response;
      });
    }),
  );
});

// Listen for messages from clients
self.addEventListener("message", (event) => {
  console.log("[SW] Message received:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
