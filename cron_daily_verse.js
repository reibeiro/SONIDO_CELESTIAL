/**
 * Script Automatizado de "Versículo del Día" para Radio Sonido Celestial
 * Programable a las 8:00 AM y 8:00 PM (Hora Colombia America/Bogota)
 */

const admin = require('firebase-admin');
const fetch = require('node-fetch');

// 1. Inicializar Firebase Admin SDK con Service Account
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    projectId: "sonido-celestal"
  });
}

const db = admin.firestore();

// Banco de respaldo de 40+ Promesas Bíblicas RVR1960
const BIBLE_BANK = [
  { ref: "Filipenses 4:13", text: "Todo lo puedo en Cristo que me fortalece." },
  { ref: "Juan 3:16", text: "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree no se pierda, mas tenga vida eterna." },
  { ref: "Salmos 23:1", text: "El Señor es mi pastor; nada me faltará." },
  { ref: "Salmos 27:1", text: "Jehová es mi luz y mi salvación; ¿de quién temeré? Jehová es la fortaleza de mi vida; ¿de quién he de atemorizarme?" },
  { ref: "Josué 1:9", text: "Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo en dondequiera que vayas." },
  { ref: "Jeremías 29:11", text: "Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz, y no de mal, para daros el fin que esperáis." },
  { ref: "Proverbios 3:5-6", text: "Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia. Reconócelo en todos tus caminos, y él enderezará tus veredas." },
  { ref: "Isaías 40:31", text: "Pero los que esperan a Jehová tendrán nuevas fuerzas; levantarán alas como las águilas; correrán, y no se cansarán; caminarán, y no se fatigarán." },
  { ref: "Romanos 8:28", text: "Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien, esto es, a los que conforme a su propósito son llamados." },
  { ref: "Salmos 46:1", text: "Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones." },
  { ref: "Romanos 12:2", text: "No os conforméis a este siglo, sino transformaos por medio de la renovación de vuestro entendimiento, para que comprobéis cuál sea la buena voluntad de Dios, agradable y perfecta." },
  { ref: "Mateo 11:28", text: "Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar." },
  { ref: "Salmos 121:1-2", text: "Alzaré mis ojos a los montes; ¿De dónde vendrá mi socorro? Mi socorro viene de Jehová, Que hizo los cielos y la tierra." },
  { ref: "Isaías 41:10", text: "No temas, porque yo estoy contigo; no desmayes, porque yo soy tu Dios que te esfuerzo; siempre te ayudaré, siempre te sustentaré con la diestra de mi justicia." },
  { ref: "Hebreos 11:1", text: "Es, pues, la fe la certeza de lo que se espera, la convicción de lo que no se ve." },
  { ref: "Proverbios 16:3", text: "Encomienda a Jehová tus obras, y tus pensamientos serán afirmados." },
  { ref: "Salmos 91:1-2", text: "El que habita al abrigo del Altísimo morará bajo la sombra del Omnipotente. Diré yo a Jehová: Esperanza mía, y castillo mío; Mi Dios, en quien confiaré." },
  { ref: "2 Timoteo 1:7", text: "Porque no nos ha dado Dios espíritu de cobardía, sino de poder, de amor y de dominio propio." },
  { ref: "Santiago 1:5", text: "Y si alguno de vosotros tiene falta de sabiduría, pídala a Dios, el cual da a todos abundantemente y sin reproche, y le será dada." },
  { ref: "Filipenses 4:6-7", text: "Por nada estéis afanosos, sino sean conocidas vuestras peticiones delante de Dios en toda oración y ruego, con acción de gracias. Y la paz de Dios, que sobrepasa todo entendimiento, guardará vuestros corazones y vuestros pensamientos en Cristo Jesús." }
];

async function dispatchDailyVerse() {
  console.log("📖 Iniciando despacho automatizado de Versículo del Día...");

  // Seleccionar un versículo aleatorio por defecto del banco
  const randomFallback = BIBLE_BANK[Math.floor(Math.random() * BIBLE_BANK.length)];
  let verseRef = randomFallback.ref;
  let verseText = randomFallback.text;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const res = await fetch("https://bible-api.com/?random=verse&translation=rv1960", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RadioSonidoCelestial/1.7'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.text && data.reference) {
        verseText = data.text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        verseRef = data.reference;
        console.log("🌐 Cita obtenida exitosamente desde API pública:", verseRef);
      }
    }
  } catch (err) {
    console.warn("⚠️ API Bíblica ocupada o bloqueada, utilizando versículo del banco RVR1960:", verseRef);
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
  console.log("🚀 Notificación Push despachada con éxito a 'all_listeners':", response);
}

dispatchDailyVerse().catch(console.error);
