// Øk CACHE når filene i appen endres, så telefonen henter den nye versjonen.
const CACHE = "trening-v1";

const FILER = [
  "./index.html",
  "./css/app.css",
  "./js/app.js",
  "./js/modell.js",
  "./js/lagring.js",
  "./manifest.webmanifest",
  "./data/uker.json",
  "./data/ukeplan-uke45-2026.json",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILER);
    const side = await cache.match("./index.html");
    if (side) await cache.put("./", side.clone());
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((nokler) => Promise.all(nokler.filter((nokkel) => nokkel !== CACHE).map((nokkel) => caches.delete(nokkel))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(svar(event.request));
});

async function svar(request) {
  const cache = await caches.open(CACHE);
  const lagret = await cache.match(request);
  if (lagret) return lagret;
  try {
    const response = await fetch(request);
    if (response && response.ok && new URL(request.url).origin === self.location.origin) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (feil) {
    if (request.mode === "navigate") {
      const side = await cache.match("./index.html");
      if (side) return side;
    }
    throw feil;
  }
}
