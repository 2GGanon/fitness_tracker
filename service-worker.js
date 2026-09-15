const CACHE_NAME = 'fitness-tracker-v40'
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=2026-09-15-10',
  './app.js?v=2026-09-15-7',
  './manifest.webmanifest'
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return
  event.respondWith(
    caches.match(event.request).then(cached => {
      if(cached) return cached
      return fetch(event.request).then(resp => {
        // only cache successful responses
        if(!resp || resp.status !== 200 || resp.type !== 'basic') return resp
        const copy = resp.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy))
        return resp
      }).catch(()=> caches.match('./index.html'))
    })
  )
})
