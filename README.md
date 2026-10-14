<!-- ========================================== -->
<!--           INSIGNIAS DEL PROYECTO            -->
<!-- ========================================== -->

<p align="center">
  <img src="https://img.shields.io/badge/versión-1.7.0-FCAD04?style=for-the-badge" alt="Versión">
  <img src="https://img.shields.io/badge/Android-API%2024%2B-brightgreen?style=for-the-badge&logo=android" alt="Android">
  <img src="https://img.shields.io/badge/Target%20SDK-36%20(Android%2016)-blue?style=for-the-badge&logo=google-play" alt="Target SDK 36">
  <img src="https://img.shields.io/badge/licencia-MIT-green?style=for-the-badge" alt="Licencia">
  <img src="https://img.shields.io/badge/estable-sí-success?style=for-the-badge" alt="Estable">
</p>

<!-- ========================================== -->
<!--           LOGO Y TÍTULO                     -->
<!-- ========================================== -->

<p align="center">
  <h1 align="center">📻 Sonido Celestial Radio</h1>
  <p align="center">Aplicación móvil nativa e híbrida de radio en vivo para Android</p>
</p>

<!-- ========================================== -->
<!--           ENLACES DE DESCARGA               -->
<!-- ========================================== -->

<p align="center">
  <a href="https://play.google.com/store/apps/details?id=com.sonidocelestial.radio">
    <img src="https://img.shields.io/badge/📲%20DESCARGAR%20EN%20GOOGLE%20PLAY-FCAD04?style=for-the-badge&logo=google-play&logoColor=black" alt="Descargar en Google Play">
  </a>
  <a href="https://github.com/reibeiro/SONIDO_CELESTIAL">
    <img src="https://img.shields.io/badge/📂%20VER%20CÓDIGO%20GITHUB-181717?style=for-the-badge&logo=github&logoColor=white" alt="Ver Código">
  </a>
</p>

<!-- ========================================== -->
<!--           INSIGNIAS TÉCNICAS                -->
<!-- ========================================== -->

<p align="center">
  <img src="https://img.shields.io/badge/Kotlin-2.2.10-purple?style=flat-square&logo=kotlin" alt="Kotlin">
  <img src="https://img.shields.io/badge/Media3%20ExoPlayer-1.5.1-red?style=flat-square&logo=youtube" alt="ExoPlayer">
  <img src="https://img.shields.io/badge/Firebase-FCM%20%26%20Firestore-orange?style=flat-square&logo=firebase" alt="Firebase">
  <img src="https://img.shields.io/badge/Android%20Studio-2026.1.4-green?style=flat-square&logo=android-studio" alt="Android Studio">
  <img src="https://img.shields.io/badge/tamaño-~2.9%20MB-success?style=flat-square" alt="Tamaño APK">
</p>

---

## 🎵 ¿Qué es Sonido Celestial Radio?

**Sonido Celestial Radio** es una aplicación móvil de alto rendimiento diseñada para la transmisión de audio 24/7 y video en vivo. Combina un potente motor nativo en **Kotlin (Media3 ExoPlayer)** para la reproducción continua en segundo plano con una interfaz híbrida **Glassmorphic en Canvas HTML5** a 60 FPS, logrando una experiencia auditiva y visual inigualable con un tamaño ultra-ligero (**~2.9 MB**).

---

### ✨ Características Principales (v1.7.0)

- 🎧 **Streaming en Vivo 24/7:** Reproducción continua en segundo plano con Media3 ExoPlayer, control en pantalla de bloqueo, metadatos Bluetooth e integración de carátulas HD (`600x600`).
- 📖 **Versículo del Día & Biblia RVR1960:** Notificaciones automáticas programadas (8:00 AM y 8:00 PM Colombia `America/Bogota`) con promesas bíblicas. Redirección táctil directa a la pestaña de la Biblia al presionar la alerta.
- 🎛️ **Ecualizador Quad-Modo (Canvas 60 FPS):** Cuatro estilos de visualización de espectro conmutables con 1 toque:
  1. 📊 *Barras 3D Neón*
  2. 💊 *Cápsulas Simétricas (Up & Down)*
  3. ⭕ *Onda Circular Polar (Halo Reactivo)*
  4. 〰️ *Osciloscopio 3D Holográfico*
- 🔔 **Bandeja de Avisos Importantes:** Historial de comunicados recientes en la campana 🔔 con opción de borrado masivo por lotes exclusivo para el administrador.
- 📹 **Transmisiones de Video en Vivo:** Reproductor HD integrado para YouTube Live (con soporte Fullscreen) y apertura nativa para Facebook Live.
- 🔓 **Panel Administrador In-App:** Control en tiempo real de la programación, avisos push y videos en vivo mediante Firebase Auth y Firestore sin necesidad de recompilar la app.
- 🌙 **Temporizador de Apagado (Sleep Timer):** Reloj digital de cuenta regresiva con apagado programado.
- 🙏 **Petición de Oración por WhatsApp:** Formulario interactivo con envío directo formateado.
- 🔒 **Privacidad Total y Cero Permisos Invasivos:** Totalmente libre de solicitudes de micrófono o grabación de audio.

---

## 📸 Capturas de Pantalla y Capturas de la App

<p align="center">
  <img src="https://github.com/user-attachments/assets/7f064dc5-2e58-4639-8087-b07748cce55c" width="220" alt="Pantalla principal Sonido Celestial">
</p>

---

## 🔧 Instalación y Compilación

### 📲 Opción 1: Descargar directamente la APK de prueba
1. Descarga la versión compilada [app-release.apk](android_app/app/release/Sonido_Celestial.apk).
2. Habilita "Instalar orígenes desconocidos" en las configuraciones de tu dispositivo Android.
3. Abre e instala el archivo APK.

### 🛠️ Opción 2: Compilar desde el Código Fuente
```bash
# 1. Clonar el repositorio
git clone https://github.com/reibeiro/SONIDO_CELESTIAL.git

# 2. Entrar a la carpeta del proyecto Android
cd SONIDO_CELESTIAL/android_app

# 3. Compilar APK Debug/Release con Gradle
./gradlew :app:assembleRelease
```

---

### ⏰ Script de Automatización Cron (Versículo del Día)
El repositorio incluye el archivo [cron_daily_verse.js](cron_daily_verse.js) y la acción programada [.github/workflows/daily_verse_cron.yml](android_app/.github/workflows/daily_verse_cron.yml) que ejecuta automáticamente el envío de versículos bíblicos dos veces al día (8:00 AM y 8:00 PM Colombia `America/Bogota`) a todos los oyentes mediante Firebase Cloud Messaging.

---

*Desarrollado para Radio Sonido Celestial — Música y Palabra que edifica tu vida.*
