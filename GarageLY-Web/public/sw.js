// GarageLY PWA service worker.
// Strategy:
//  • Navigations (HTML)  -> network-first, fall back to cached app shell offline.
//    This guarantees users always get the newest build when online (no stale app).
//  • Same-origin static  -> cache-first, then network (hashed assets are immutable).
//  • Cross-origin (Supabase / the Worker API) -> never touched; goes straight to
//    the network so data is always live and never cached here.
// Bump CACHE_VERSION to force old caches to clear on the next visit.
const CACHE_VERSION = 'garagely-v2'
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/garagely-logo-dark.png',
  '/assets/pwa-192.png',
  '/assets/pwa-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  let url
  try { url = new URL(req.url) } catch { return }

  // Only handle our own origin — let Supabase / Worker API calls go to the network untouched.
  if (url.origin !== self.location.origin) return

  // App navigations: network-first so updates land immediately; offline -> cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    )
    return
  }

  // Static assets: cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy))
        }
        return res
      }).catch(() => cached)
    }),
  )
})
