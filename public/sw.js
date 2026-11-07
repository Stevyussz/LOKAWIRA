// Service worker LOKAWIRA. Ganti VERSION tiap ubah strategi cache biar cache lama dibuang
const VERSION = "lkw-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // cuma asal sendiri. Ubin peta, rute, & AI dr luar gak disentuh
  if (url.origin !== self.location.origin) return;
  // data API (akun, voucer, tiket) gak pernah dicache: selalu segar & gak bocor antar akun
  if (url.pathname.startsWith("/api/")) return;

  // aset build (nama berhash, gak berubah) & ikon: ambil dr cache dulu
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // halaman: internet dulu (biar selalu terbaru), kalo gagal pakai salinan terakhir, kalo blm ada ke /offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(PAGES).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/offline")))
    );
  }
});
