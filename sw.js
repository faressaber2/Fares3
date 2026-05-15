var CACHE = 'diyar-v8';
var ASSETS = ['/', '/index.html', '/manifest.json', '/style.css', '/app.js', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); })
      .catch(function(err){ console.warn('Cache install failed:', err); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  if(!e.request.url.startsWith(self.location.origin)) return;

  if(e.request.mode === 'navigate'){
    e.respondWith(
      fetch(e.request)
        .then(function(res){
          var clone = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
          return res;
        })
        .catch(function(){
          // Try cache first, then cached index
          return caches.match(e.request).then(function(cached){
            return cached || caches.match('/index.html') || caches.match('/');
          });
        })
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(function(res){
        if(res && res.status === 200){
          var clone = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
        }
        return res;
      })
      .catch(function(){ return caches.match(e.request); })
  );
});

self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
