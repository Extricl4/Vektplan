/* Vektplan service worker.
   Keeps the app working offline and controls updates.
   VERSION and ASSETS are rewritten by tools/bump.py — don't edit them by hand. */
const VERSION = '1.3.0';
const CACHE = 'vektplan-' + VERSION;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/ai.js',
  './js/amount.js',
  './js/app.js',
  './js/data/amounts.js',
  './js/data/exercises.js',
  './js/data/foods.js',
  './js/data/programs.js',
  './js/data/recipes.js',
  './js/data/shopping.js',
  './js/data/words.js',
  './js/data/workouts.js',
  './js/encourage.js',
  './js/health.js',
  './js/history.js',
  './js/i18n.js',
  './js/meals.js',
  './js/mymeals.js',
  './js/nav.js',
  './js/patterns.js',
  './js/planner.js',
  './js/store.js',
  './js/supps.js',
  './js/theme.js',
  './js/training.js',
  './js/ui.js',
  './js/updates.js',
  './js/util.js',
  './js/version.js',
  './js/views/coach.js',
  './js/views/food.js',
  './js/views/fuel.js',
  './js/views/health.js',
  './js/views/log.js',
  './js/views/mymeal.js',
  './js/views/plan.js',
  './js/views/program.js',
  './js/views/progress.js',
  './js/views/recipe.js',
  './js/views/session.js',
  './js/views/settings.js',
  './js/views/setup.js',
  './js/views/supps.js',
  './js/views/today.js',
  './js/views/train.js',
  './js/views/workout.js',
  './fonts/figtree-400.woff2',
  './fonts/figtree-500.woff2',
  './fonts/figtree-600.woff2',
  './fonts/figtree-700.woff2',
  './fonts/figtree-800.woff2',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => {
        // First install: take over right away. Later updates wait for the user to tap "Update".
        if (!self.registration.active) return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('vektplan-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'GET_VERSION' && event.ports && event.ports[0]) event.ports[0].postMessage({ version: VERSION });
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API calls and other sites go straight to the network

  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => new Response('{}', { headers: { 'content-type': 'application/json' } }))
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE).then((cache) => cache.match('./index.html')).then((cached) => cached || fetch(req))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        });
      })
    )
  );
});
