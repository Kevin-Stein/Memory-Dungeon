// ═══════════════════════════════════════════════════════
//  SERVICE WORKER — sw.js
//  Enables offline play via cache-first strategy.
// ═══════════════════════════════════════════════════════

const CACHE = 'dungeon-memory-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/data.js',
  './js/sound.js',
  './js/sprites.js',
  './js/background.js',
  './js/game.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(ASSETS).catch(function(){}); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e){
  e.respondWith(
    caches.match(e.request).then(function(r){ return r || fetch(e.request).catch(function(){}); })
  );
});
