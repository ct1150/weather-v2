const SHELL_CACHE = "wnr-shell-v1";
const RUNTIME_CACHE = "wnr-runtime-v1";
const CORE = [
  "/",
  "/trips",
  "/trips/workspace",
  "/trips/execution",
  "/zh-cn/trips",
  "/zh-cn/trips/workspace",
  "/zh-cn/trips/execution",
  "/zh-hant/trips",
  "/zh-hant/trips/workspace",
  "/zh-hant/trips/execution",
  "/favicon.svg",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => Promise.allSettled(CORE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function cacheable(request, response) {
  return request.method === "GET" && response && response.ok && response.type === "basic";
}

function executionFallback(pathname) {
  if (pathname.startsWith("/zh-hant/")) return "/zh-hant/trips/execution";
  if (pathname.startsWith("/zh-cn/")) return "/zh-cn/trips/execution";
  return "/trips/execution";
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (cacheable(request, response)) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await caches.open(SHELL_CACHE);
    const pathname = new URL(request.url).pathname;
    return (
      (await shell.match(request)) ||
      (await shell.match(executionFallback(pathname))) ||
      (await shell.match("/")) ||
      Response.error()
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (cacheable(request, response)) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await refresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/") ||
    /\.(?:css|js|svg|png|jpg|jpeg|webp|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
