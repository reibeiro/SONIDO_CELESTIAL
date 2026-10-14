/**
 * Script Automatizado de "Versículo del Día" para Radio Sonido Celestial
 * Programable a las 8:00 AM y 8:00 PM (Hora Colombia America/Bogota)
 *
 * Requiere:
 * npm install firebase-admin node-fetch@2
 */

const admin = require('firebase-admin');
const fetch = require('node-fetch');

// 1. Inicializar Firebase Admin SDK con Service Account o credenciales de entorno
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    projectId: "sonido-celestal"
  });
}

const db = admin.firestore();

async function dispatchDailyVerse() {
  console.log("📖 Iniciando despacho automatizado de Versículo del Día...");

  let verseRef = "Filipenses 4:13";
  let verseText = "Todo lo puedo en Cristo que me fortalece.";

  try {
    const res = await fetch("https://bible-api.com/?random=verse&translation=rv1960");
    if (res.ok) {
      const data = await res.json();
      if (data && data.text && data.reference) {
        verseText = data.text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        verseRef = data.reference;
      }
    }
  } catch (err) {
    console.warn("⚠️ API Bíblica no disponible, usando respaldo local RVR1960:", err);
  }

  const pushTitle = `📖 Versículo del Día: ${verseRef}`;
  const pushBody = verseText;

  // 2. Guardar en Firestore (Colección notification_requests)
  const docRef = await db.collection('notification_requests').add({
    title: pushTitle,
    body: pushBody,
    type: 'verse',
    topic: 'all_listeners',
    sentBy: 'cron_bot@sonidocelestial.com',
    createdAt: new Date().toISOString()
  });

  console.log(`✅ Documento guardado en Firestore ID: ${docRef.id}`);

  // 3. Despachar Notificación Push FCM masiva al tema 'all_listeners'
  const message = {
    topic: 'all_listeners',
    notification: {
      title: pushTitle,
      body: pushBody
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'radio_events_channel'
      }
    },
    data: {
      title: pushTitle,
      body: pushBody,
      target_tab: 'bible',
      type: 'verse'
    }
  };

  const response = await admin.messaging().send(message);
  console.log("🚀 Notificación Push despachada con éxito:", response);
}

dispatchDailyVerse().catch(console.error);
