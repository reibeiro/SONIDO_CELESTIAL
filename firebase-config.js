// Firebase Configuration for Radio Sonido Celestial
const firebaseConfig = {
    apiKey: "AIzaSyDlp8lprRn0zzuE-ca7P23y9vzjjnAlLyk",
    authDomain: "sonido-celestal.firebaseapp.com",
    projectId: "sonido-celestal",
    storageBucket: "sonido-celestal.firebasestorage.app",
    messagingSenderId: "400869614864",
    appId: "1:400869614864:web:a0ff89a204f605c0f8f195",
    measurementId: "G-0LT1NQJFVC",
    fcmServerKey: "AQUI_TU_CLAVE_DE_SERVIDOR_FCM"
};

// Inicializar Firebase Compat SDK
let db = null;
let auth = null;
let messaging = null;

if (typeof firebase !== 'undefined' && firebase.apps) {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        auth = firebase.auth();
        if (firebase.messaging && firebase.messaging.isSupported()) {
            messaging = firebase.messaging();
        }
        console.log("Firebase inicializado correctamente para Sonido Celestial");
    } catch (e) {
        console.warn("Error al inicializar Firebase:", e);
    }
}
