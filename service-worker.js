const CACHE_NAME = 'radio-sonido-celestial-v1';
const LOCAL_ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './logo.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(LOCAL_ASSETS);
        })
    );
});

self.addEventListener('fetch', (e) => {
    const request = e.request;
    const url = new URL(request.url);

    // CDN assets: network first, cache fallback
    if (url.origin === 'https://cdnjs.cloudflare.com' || url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
        e.respondWith(
            fetch(request)
                .then((response) => {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Local assets: cache first, network fallback
    e.respondWith(
        caches.match(request).then((response) => {
            return response || fetch(request);
        })
    );
});
