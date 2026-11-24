// Offline-Speicher fürs Spiel (Service Worker).
// Seite: erst Internet versuchen (damit Updates sofort kommen), ohne Netz aus dem Speicher.
// Bilder, Manifest, Schrift: aus dem Speicher, im Hintergrund auffrischen.
const CACHE = "doan-chu-v1";
const FILES = ["./", "index.html", "manifest.webmanifest", "apple-touch-icon.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(r => { clearTimeout(t); resolve(r); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.includes("/easy/")) return;   // die leichte Version hat ihren eigenen Speicher
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return;

  // Die Seite selbst: Netz zuerst (max. 3 s), sonst gespeicherte Fassung
  if (req.mode === "navigate") {
    e.respondWith(
      withTimeout(fetch(req), 3000)
        .then(res => {
          // Nur gute Antworten speichern, sonst ersetzt eine Fehlerseite die brauchbare Offline-Fassung
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put("index.html", copy)); }
          return res;
        })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  // Alles andere: Speicher zuerst, im Hintergrund auffrischen
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req).then(hit => {
        const net = fetch(req)
          .then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; })
          .catch(() => hit);
        return hit || net;
      })
    )
  );
});
