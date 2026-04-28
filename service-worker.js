// ==================== AGILE HUNTER - Service Worker ====================
const CACHE_NAME = 'agile-hunter-v2';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json'
];

// ==================== INSTALACIÓN ====================
self.addEventListener('install', (event) => {
    console.log('🚗 Service Worker: Instalando...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Cacheando archivos estáticos');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('✅ Instalación completada');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Error en instalación:', error);
            })
    );
});

// ==================== ACTIVACIÓN ====================
self.addEventListener('activate', (event) => {
    console.log('🚗 Service Worker: Activando...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('🗑️ Eliminando cache viejo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Activación completada');
                return self.clients.claim();
            })
    );
});

// ==================== INTERCEPTAR REQUESTS ====================
self.addEventListener('fetch', (event) => {
    // No interceptar requests a Google APIs (Apps Script)
    if (event.request.url.includes('script.google.com') || 
        event.request.url.includes('googleapis.com')) {
        // Para APIs, intentar red primero, si falla devolver error
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return new Response(
                        JSON.stringify({ 
                            ok: false, 
                            mensaje: 'Sin conexión a internet' 
                        }),
                        { 
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                })
        );
        return;
    }

    // Para recursos estáticos: Cache First, luego Network
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Devolver del cache y actualizar en segundo plano
                    const fetchPromise = fetch(event.request)
                        .then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200) {
                                const responseClone = networkResponse.clone();
                                caches.open(CACHE_NAME)
                                    .then((cache) => {
                                        cache.put(event.request, responseClone);
                                    });
                            }
                            return networkResponse;
                        })
                        .catch(() => {
                            console.log('📡 Sin conexión, usando cache');
                        });
                    
                    return cachedResponse;
                }
                
                // Si no está en cache, buscar en red
                return fetch(event.request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseClone);
                                });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Si es una página HTML, devolver el index.html del cache
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        return new Response('Sin conexión', { status: 408 });
                    });
            })
    );
});

// ==================== NOTIFICACIONES PUSH ====================
self.addEventListener('push', (event) => {
    console.log('📨 Push recibido:', event);
    
    let data = {
        title: '🚗 Agile Hunter',
        body: '¡Hay novedades en el juego!',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🚗</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏁</text></svg>',
        tag: 'agile-hunter-notification',
        vibrate: [200, 100, 200],
        data: {
            url: './'
        }
    };

    if (event.data) {
        try {
            const pushData = event.data.json();
            data = { ...data, ...pushData };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            tag: data.tag,
            vibrate: data.vibrate,
            data: data.data,
            requireInteraction: true,
            actions: [
                {
                    action: 'open',
                    title: '🔍 Ver juego'
                },
                {
                    action: 'close',
                    title: '❌ Cerrar'
                }
            ]
        })
    );
});

// ==================== CLICK EN NOTIFICACIÓN ====================
self.addEventListener('notificationclick', (event) => {
    console.log('👆 Click en notificación:', event);
    
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    // Abrir o focalizar la página del juego
    const urlToOpen = event.notification.data?.url || './';
    
    event.waitUntil(
        clients.matchAll({ 
            type: 'window',
            includeUncontrolled: true 
        })
        .then((windowClients) => {
            // Buscar si ya hay una pestaña abierta
            for (const client of windowClients) {
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Si no hay pestaña abierta, abrir una nueva
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// ==================== SINCRONIZACIÓN EN SEGUNDO PLANO ====================
self.addEventListener('sync', (event) => {
    console.log('🔄 Sync event:', event.tag);
    
    if (event.tag === 'check-scores') {
        event.waitUntil(
            clients.matchAll({ type: 'window' })
                .then((windowClients) => {
                    if (windowClients.length > 0) {
                        windowClients[0].postMessage({
                            type: 'CHECK_SCORES',
                            timestamp: Date.now()
                        });
                    }
                })
        );
    }
});

// ==================== MENSAJES DESDE LA PÁGINA ====================
self.addEventListener('message', (event) => {
    console.log('📬 Mensaje recibido:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    // Notificar a todas las pestañas abiertas
    if (event.data && event.data.type === 'NEW_AGILE') {
        clients.matchAll({ type: 'window' })
            .then((windowClients) => {
                windowClients.forEach((client) => {
                    client.postMessage({
                        type: 'AGILE_ADDED',
                        jugador: event.data.jugador,
                        puntos: event.data.puntos,
                        patente: event.data.patente,
                        timestamp: Date.now()
                    });
                });
            });
    }
});
