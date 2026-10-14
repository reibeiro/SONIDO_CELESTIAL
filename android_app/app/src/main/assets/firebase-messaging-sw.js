importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDlp8lprRn0zzuE-ca7P23y9vzjjnAlLyk",
    authDomain: "sonido-celestal.firebaseapp.com",
    projectId: "sonido-celestal",
    storageBucket: "sonido-celestal.firebasestorage.app",
    messagingSenderId: "400869614864",
    appId: "1:400869614864:web:a0ff89a204f605c0f8f195"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Background message received:', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || 'Radio Sonido Celestial';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || '¡Hay una transmisión especial en vivo!',
        icon: 'logo.png',
        badge: 'logo.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
