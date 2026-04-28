const CACHE_NAME = 'agile-hunter-v3';
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => 
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('script.google.com')) {
        event.respondWith(fetch(event.request).catch(() => 
            new Response(JSON.stringify({ ok: false, mensaje: 'Sin conexión' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            })
        ));
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => 
            cached || fetch(event.request).then(response => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
        )
    );
});

self.addEventListener('push', event => {
    const data = event.data?.json() || {};
    event.waitUntil(
        self.registration.showNotification(data.title || '🚗 Agile Hunter', {
            body: data.body || '¡Alguien cazó un Agile!',
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🚗</text></svg>',
            badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏁</text></svg>',
            tag: 'agile-hunter',
            vibrate: [200, 100, 200],
            requireInteraction: true,
            actions: [
                { action: 'open', title: '🔍 Ver juego' },
                { action: 'close', title: '❌ Cerrar' }
            ]
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    if (event.action !== 'close') {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then(clients => {
                    const client = clients.find(c => c.url.includes(self.location.origin));
                    return client ? client.focus() : clients.openWindow('./');
                })
        );
    }
});
