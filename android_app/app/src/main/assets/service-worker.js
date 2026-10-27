const CACHE_NAME = 'radio-sonido-celestial-v1.7.3';
const LOCAL_ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './logo.png'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(LOCAL_ASSETS);
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('Clearing old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const request = e.request;
    const url = new URL(request.url);

    // Network first strategy so web browsers always get the latest update!
    if (request.method === 'GET') {
        e.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const cloned = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request);
                })
        );
    }
});
