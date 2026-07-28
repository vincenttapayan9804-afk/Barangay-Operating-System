// Registered solely to satisfy PWA installability criteria (a controlling
// service worker with a fetch handler). This app's offline support is
// handled by the app itself (local queue + sync on reconnect), not by
// asset caching here, so this worker deliberately caches nothing and
// simply passes every request straight through to the network.

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      // Clean up any caches left behind by the previous (self-unregistering)
      // version of this file.
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('barangayos-')).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  )
})

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request))
})
