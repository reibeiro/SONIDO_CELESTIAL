# Reporte Técnico — Radio Sonido Celestial

## 1. Resumen Ejecutivo

### Descripción general
Aplicación híbrida Android + PWA para streaming de radio en vivo. La app envuelve una interfaz web (`WebView`) que se comunica con un servicio nativo de reproducción (`AudioService` con ExoPlayer). Incluye funcionalidades como: reproducción en segundo plano con notificación persistente, visualizador de onda animado, historial de canciones (localStorage), búsqueda de carátulas vía iTunes API, integración con MediaSession y botones sociales (Facebook, WhatsApp).

### Tecnologías utilizadas
| Capa | Tecnologías |
|------|-------------|
| **Web UI** | HTML5, CSS3 (flexbox, glassmorphism, keyframes CSS) |
| **Web lógica** | Vanilla JS (ES2021), Canvas 2D (starfield), SSE (Server-Sent Events) |
| **PWA** | Service Worker (cache-first), manifest.json (standalone) |
| **Android** | Kotlin, AppCompat 1.6.1, Material 1.11.0 |
| **Reproducción** | ExoPlayer (Media3 1.3.1), MediaSession |
| **Splash** | core-splashscreen 1.0.1 |
| **Build** | Gradle 8.13, compileSdk 34, minSdk 24, Kotlin 1.9.22 |
| **CI/CD** | GitHub Actions (lint JS/CSS + build APK por push a main) |
| **Stream** | Zeno FM (HLS/MP3 vía ExoPlayer) |

### Estado actual
- Compila exitosamente (`BUILD SUCCESSFUL` en ~5s)
- Web lint (ESLint + Stylelint) funcional
- APK debug generado correctamente
- La app se encuentra en fase de refinamiento visual (UI V3) con todos los componentes core operativos: reproducción, metadatos en vivo, notificación foreground, puente volumen bidireccional, splash screen

---

## 2. Arquitectura

### Estructura de carpetas
```
SONIDO_CELESTIAL/
├── index.html                  # UI principal PWA
├── style.css                   # Estilos (552 líneas)
├── script.js                   # Lógica JS (468 líneas)
├── logo.png                    # Logo oficial (1024×1024)
├── favicon.ico                 # Favicon
├── manifest.json               # Web App Manifest PWA
├── service-worker.js           # Service Worker
├── sync-assets.ps1             # Script sincronización assets web → Android
├── package.json                # Config NPM (linting)
│
├── android_app/
│   ├── build.gradle            # Build project-level
│   ├── settings.gradle
│   ├── gradle.properties
│   ├── app/
│   │   ├── build.gradle        # Build app-level (deps, SDK)
│   │   ├── proguard-rules.pro
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── assets/         # Web assets para WebView
│   │   │   │   └── index.html, style.css, script.js, logo.png, ...
│   │   │   ├── java/com/example/sonidocelestial/
│   │   │   │   ├── MainActivity.kt
│   │   │   │   ├── AudioService.kt
│   │   │   │   └── RadioInterface.kt
│   │   │   └── res/
│   │   │       ├── drawable/       # Vectores, splash, logo.png
│   │   │       ├── drawable-*/     # Ic_stat_name density variants
│   │   │       ├── layout/         # activity_main.xml
│   │   │       ├── mipmap-*/       # Launcher icons (adaptive)
│   │   │       ├── values/         # colors, strings, themes, ic_launcher_background
│   │   │       ├── values-night/   # themes.xml (night variant)
│   │   │       └── xml/            # backup_rules, data_extraction_rules
│   │   └── build/              # Artefactos de compilación
│   ├── gradle/wrapper/
│   └── gradlew / gradlew.bat
│
├── docs/                       # Documentación
├── .github/workflows/ci.yml    # CI pipeline
└── *.md                        # 18 reportes markdown en raíz
```

### Flujo de funcionamiento

```
Inicio App
    │
    ▼
┌─────────────────────────────────────────┐
│  MainActivity.onCreate()                 │
│  • installSplashScreen() (API sistema)   │
│  • setContentView(activity_main.xml)     │
│  • Splash overlay animado (2.2s)         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  WebView carga index.html (assets/)      │
│  • JavaScript habilitado                 │
│  • DOM storage habilitado                │
│  • RadioInterface expuesto como Android  │
└──────────────┬──────────────────────────┘
               │
     ┌─────────┴──────────┐
     ▼                    ▼
  Usuario Play         JS detecta SSE
     │                 (Zeno FM metadata)
     ▼                    │
┌──────────────┐          ▼
│  togglePlay()│   updateMetadata()
│  → Android   │   → songTitle, artist,
│    .play()   │     album art (iTunes)
└──────┬───────┘          │
       │                  ▼
       ▼          Android.updateMetadata()
┌──────────────────┐     (JS→RadioInterface)
│  AudioService     │          │
│  • ExoPlayer       │          ▼
│  • MediaSession    │   AudioService
│  • Notification    │   • Update notification
│    foreground      │   • Fetch bitmap
└──────────────────┘
       │
       ▼
┌───────────────────┐
│  Slider volumen   │
│  → setVolume()    │
│  → ExoPlayer      │
│    .volume        │
└───────────────────┘
```

### Relación Android ↔ WebView ↔ JavaScript
```
┌────────────────────────────────────────────────┐
│                  MAIN ACTIVITY                   │
│  ┌─────────────────────────────────────────────┐│
│  │              WebView                         ││
│  │  ┌───────────────────────────────────────┐  ││
│  │  │  index.html + style.css + script.js    │  ││
│  │  │                                         │  ││
│  │  │  Android.play(url, title, artist, art)  │──┼──→ RadioInterface.kt
│  │  │  Android.pause()                        │──┼──→ (JavascriptInterface)
│  │  │  Android.setVolume(vol)                 │──┼──→  ─→ Intent
│  │  │  Android.getVolume() → return Double    │──┼──→  ─→ AudioService
│  │  │  Android.updateMetadata(t, a, art)      │──┼──→      (ExoPlayer)
│  │  │                                         │  ││
│  │  └───────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Splash overlay (fade-in/fade-out animado)      │
└────────────────────────────────────────────────┘
```

---

## 3. Análisis del Código

### Archivos principales y responsabilidades

#### Web (`/` raíz)

| Archivo | Líneas | Responsabilidad |
|---------|--------|-----------------|
| `index.html` | 92 | Estructura UI: header, logo, now-playing card, visualizer, controles, historial, redes sociales |
| `style.css` | 485 | Sistema visual completo: tema dorado/oscuro, glassmorphism, animaciones, responsive |
| `script.js` | 411 | Toda la lógica del cliente: streaming, metadata SSE, puente Android, historial, starfield canvas, visualizer DOM |

#### Android (`android_app/app/src/main/java/.../`)

| Archivo | Líneas | Responsabilidad |
|---------|--------|-----------------|
| `MainActivity.kt` | 134 | Entry point: WebView config, splash animado, permisos notificación, control back, edge-to-edge |
| `AudioService.kt` | 285 | Foreground Service: ExoPlayer, MediaSession, notificación media, búsqueda carátula iTunes, volumen |
| `RadioInterface.kt` | 55 | Puente JS↔Android vía `@JavascriptInterface`: play, pause, setVolume, getVolume, updateMetadata |

#### Android (`res/`)

| Archivo | Propósito |
|---------|-----------|
| `activity_main.xml` | Layout: WebView fullscreen + splash overlay con logo, nombre, versión, desarrollador |
| `themes.xml` | Tema base + splash theme (MaterialComponents DayNight NoActionBar) |
| `colors.xml` | Paleta: gold_primary #FFEB3B, gold_container #33FCAD04, dark_background #FF121212 |
| `ic_notification.xml` | Icono notificación (bitmap → logo.png) |
| `splash_icon.xml` | Icono splash (inset 25% + logo.png) |

### Dependencias utilizadas

**Android (app/build.gradle):**
```
androidx.appcompat:appcompat:1.6.1
com.google.android.material:material:1.11.0
androidx.constraintlayout:constraintlayout:2.1.4
org.jetbrains.kotlin:kotlin-stdlib:1.9.22
androidx.activity:activity:1.8.2
androidx.core:core-ktx:1.12.0
androidx.media:media:1.7.0
androidx.media3:media3-exoplayer:1.3.1
androidx.media3:media3-ui:1.3.1
androidx.media3:media3-session:1.3.1
androidx.core:core-splashscreen:1.0.1
```

**Web (package.json devDependencies):**
```
eslint: ^8.57.0
stylelint: ^16.3.0
stylelint-config-standard: ^36.0.0
```

---

## 4. Código Muerto o Innecesario

### 4.1 Archivos no referenciados

| Archivo | Razón |
|---------|-------|
| `drawable/ic_notification_combo.xml` | No referenciado — `ic_notification.xml` (bitmap logo) es el usado |
| `drawable/ic_notification_mic.xml` | No referenciado — alternativa descartada |
| `drawable/ic_notification_star.xml` | No referenciado — alternativa descartada |
| `drawable/ic_notification_wave.xml` | No referenciado — alternativa descartada |
| `drawable/splash_logo.xml` | No referenciado — reemplazado por `splash_icon.xml` en themes.xml |
| `drawable-{hdpi,mdpi,xhdpi,xxhdpi,xxxhdpi}/ic_stat_name.png` | No referenciados en ningún XML o código. Legacy de generación automática |
| `_favicon_temp.png` | Archivo temporal sobrante, no forma parte del proyecto |
| `comparativa_logo.html` | Mockup de desarrollo, no debe distribuirse |
| `mockup_recursos_android.html` | Mockup de desarrollo, no debe distribuirse |

### 4.2 Código HTML/CSS/JS no utilizado

**HTML:**
```html
<div class="background-overlay"></div>   <!-- Línea 18: sin reglas CSS asociadas -->
```

**CSS:**
- `body::before` (línea 42-55): define fondo con `--album-art`, pero el estilo de respaldo es redundante en ciertos estados
- Varias propiedades CSS con prefijos `-webkit-` duplicados (ej. `backdrop-filter` y `-webkit-backdrop-filter`)

**JS:**
- `albumArtCache` (Map): se usa pero nunca se limpia — puede crecer indefinidamente en sesiones largas
- Variable `currentStreamTitle` (línea 22): se actualiza pero solo se usa para evitar duplicados en `updateMetadata` — funcionalidad limitada
- `animFrameId` (línea 379): se cancela en `visibilitychange` pero nunca se reinicia correctamente en todos los escenarios
- `resizeTimer` (línea 379): timeout para debounce de resize, implementación frágil

### 4.3 Android código muerto

- `AudioService.updateMetadata()` (método público, línea 159): acepta `title` y `artist`, pero la versión completa desde JS envía también `albumArt` vía Intent — el método no recibe art, depende del Intent
- `fetchAlbumArt()` en AudioService (línea 297): se ejecuta dentro de `ACTION_UPDATE_METADATA`, pero el JS ya pudo haber enviado `albumArt` en el Intent — duplicación de trabajo
- `values-night/themes.xml`: duplicado completo de `values/themes.xml` (sin el splash). El tema base ya usa `DayNight.NoActionBar`, por lo que el adaptativo nocturno no agrega valor real

### 4.4 Recursos duplicados

- `logo.png` existe en: `raíz/` (238 KB), `drawable/` (238 KB), `assets/` (238 KB) — **3 copias** del mismo archivo (la de raíz y assets deben ser la misma, la de drawable también)

---

## 5. Problemas Detectados

### 5.1 Errores potenciales

| # | Severidad | Ubicación | Descripción |
|---|-----------|-----------|-------------|
| 1 | **Alta** | `AudioService.kt:301` | `HttpURLConnection` no se llama a `.disconnect()` en el bloque `catch` — fuga de recursos de red |
| 2 | **Alta** | `AudioService.kt:279` | `fetchBitmapFromUrl` no llama `.disconnect()` en ningún path — fuga de conexiones HTTP |
| 3 | **Media** | `script.js:210` | `playerContainer.style.setProperty('--album-art', 'none')` — `none` como string no es un valor válido para `background-image`. Debería ser `url('')` o `unset` |
| 4 | **Media** | `script.js:193` | `audio.play()` devuelve Promise. En el bloque `if (isAndroid())` no se captura el posible rechazo |
| 5 | **Baja** | `AudioService.kt:74` | `PendingIntent.FLAG_IMMUTABLE` requerido desde Android 12, correcto aquí. Pero `openIntent` y `cancelIntent` se crean 2 veces (en onCreate y buildNotification) — duplicación |
| 6 | **Baja** | `script.js:25-33` | `MediaSession` action handlers podrían no registrarse si `isAndroid()` es true (el audio lo maneja ExoPlayer) pero aun así se registran |

### 5.2 Problemas de rendimiento

| # | Severidad | Ubicación | Descripción |
|---|-----------|-----------|-------------|
| 1 | **Media** | `AudioService.kt:277` | Cada vez que se actualiza metadata, se crea un `Thread` para fetchBitmap — sin pool, sin límite de concurrencia |
| 2 | **Media** | `script.js:372-453` | Starfield canvas: 200 estrellas animadas con `requestAnimationFrame` continuo. Se pausa en `visibilitychange` pero se reanuda sin throttling |
| 3 | **Baja** | `AudioService.kt:297` | `fetchAlbumArt` hace petición HTTP a iTunes incluso cuando el JS ya envió `albumArt` en el Intent (porque el Intent incluye albumArt pero igual entra al fetch si está vacío) |
| 4 | **Baja** | `script.js:456-467` | 40 elementos `<span>` con `animation-delay` individual por CSS — 40 animaciones simultáneas, potencial frame drop en dispositivos de gama baja |

### 5.3 Problemas de estabilidad

| # | Severidad | Ubicación | Descripción |
|---|-----------|-----------|-------------|
| 1 | **Alta** | `AudioService.kt:49` | `companion object { var instance }` — patrón thread-unsafe para singleton. Acceso concurrente desde JS bridge (setVolume/getVolume) puede causar race conditions |
| 2 | **Media** | `script.js:145-167` | SSE reconexión con exponential backoff (5s→60s max) pero **sin límite de reintentos** — podría reconectarse indefinidamente |
| 3 | **Media** | `script.js:187-212` | `togglePlay()`: si `!isAndroid()` pero el audio HTML5 falla, no hay un estado de error claro en `isPlaying` |
| 4 | **Media** | `AudioService.kt:80` | `onStartCommand` retorna `START_STICKY`. Si el servicio es muerto por el sistema, se reinicia sin Intent → `intent?.action` es null, no hace nada |
| 5 | **Baja** | `script.js:261-262` | `localStorage.getItem` dentro de `try/catch` — correcto, pero `localStorage` puede estar lleno (cuota excedida), catch silencioso puede ocultar errores |

### 5.4 Problemas de mantenimiento

| # | Severidad | Ubicación | Descripción |
|---|-----------|-----------|-------------|
| 1 | **Alta** | `script.js:13-14` | URL de stream (Zeno FM) y URL de metadata SSE **hardcodeadas**. Si cambia el stream, hay que modificar el código |
| 2 | **Alta** | `Raíz/` | **18 archivos `.md`** en la raíz del proyecto (reportes, ADR, planes de sprint) — contaminan el directorio de trabajo |
| 3 | **Media** | `style.css` | Color `#fcad04` hardcodeado en múltiples reglas en vez de usar la variable CSS `--accent-color` |
| 4 | **Media** | `script.js` | Tiempos mágicos: 2200ms (splash), 600ms (fade-in), 500ms (fade-out), 5000ms (retry inicial SSE) — sin constantes con nombre |
| 5 | **Baja** | `AudioService.kt:50` | `currentVolume = 0.8f` hardcodeado como valor por defecto — debería venir de SharedPreferences |

---

## 6. Seguridad

### 6.1 Riesgos de WebView

| Riesgo | Configuración actual | Evaluación |
|--------|---------------------|------------|
| **XSS via JavaScript** | `setJavaScriptEnabled(true)` | Necesario para la app, mitigado por CSP |
| **File access** | `setAllowFileAccess(false)` | ✅ Seguro |
| **Content URL** | `setAllowContentAccess(false)` | ✅ Seguro |
| **File URLs** | `setAllowFileAccessFromFileURLs(false)` | ✅ Seguro |
| **Window open** | `setJavaScriptCanOpenWindowsAutomatically(false)` | ✅ Seguro |
| **JavascriptInterface** | RadioInterface expuesto como "Android" | ⚠️ Cualquier script en el WebView puede llamar `Android.*`. Riesgo bajo porque el contenido es local (file://) |

### 6.2 Configuraciones inseguras

1. **Content-Security-Policy** (index.html, línea 14): la política actual permite `script-src 'self' 'unsafe-inline'` — `unsafe-inline` es necesario por el JS inline, pero reduce la protección XSS
2. **No HTTPS check**: el WebViewClient (línea 117) permite navegación a cualquier URL con `http://` o `https://` sin validación adicional
3. **No certificate pinning**: la app confía en cualquier certificado para las conexiones a Zeno FM e iTunes
4. **AudioService en foreground**: no hay límite de tiempo para `startForegroundService` — Android 15+ podría matar el servicio si no se muestra la notificación rápido

### 6.3 Recomendaciones

- Agregar `networkSecurityConfig` en AndroidManifest para restringir tráfico solo a dominios conocidos (zeno.fm, itunes.apple.com)
- Elevar `targetSdk` a 35 y probar compliance con nuevas restricciones
- Reemplazar `unsafe-inline` por nonce o hash en CSP si es posible mover scripts a archivos externos
- Agregar verificación de URL en `shouldOverrideUrlLoading` para prevenir phishing

---

## 7. Oportunidades de Mejora

### 7.1 Corto plazo (1-2 semanas)

1. **Eliminar código muerto** — remover drawables alternativos (combo, mic, star, wave), `_favicon_temp.png`, mockups HTML, `ic_stat_name.png` variants
2. **Consolidar `logo.png`** — usar una sola copia del logo en `assets/` para WebView y referenciar desde allí. La copia en `drawable/` es innecesaria (para notificación podría referenciar desde assets)
3. **Mover archivos .md a `docs/`** — limpiar la raíz del proyecto de los 18 reportes markdown
4. **Extraer URLs de configuración** — mover stream URL y metadata URL a constantes con nombre o idealmente a un archivo de configuración
5. **Reemplazar `#fcad04` hardcodeado en CSS** por la variable `--accent-color`
6. **Agregar `disconnect()`** en los bloques `finally/catch` de `HttpURLConnection` en AudioService
7. **Eliminar `values-night/themes.xml`** si es redundante con el DayNight del tema base

### 7.2 Mediano plazo (1-2 meses)

1. **Migrar Threads a Corrutinas** — reemplazar `Thread { ... }.start()` en AudioService por `coroutineScope` con `Dispatchers.IO`
2. **Agregar caché de carátulas** — usar `LruCache` o Room para evitar fetch repetitivo a iTunes
3. **Implementar Image Loading con Coil** — reemplazar `BitmapFactory.decodeStream` manual por `Coil.execute()` (aprovecha caching, redirecciones, placeholders)
4. **Refactorizar `companion object instance`** — usar patrón singleton thread-safe o inyección de dependencias (Hilt/Koin)
5. **Persistir volumen en SharedPreferences** — en lugar de `currentVolume = 0.8f`, leer de preferencias al iniciar
6. **Reemplazar números mágicos** en splash y animaciones con constantes con nombre
7. **Limitar SSE reconexión** — agregar reintentos máximos (ej. 10) antes de mostrar error al usuario

### 7.3 Largo plazo (3-6 meses)

1. **Migrar UI Android a Jetpack Compose** — reemplazar el WebView por una interfaz nativa con mejor rendimiento y apariencia
2. **Soporte Android Auto / Apple CarPlay** — implementar `MediaBrowserService` para integración con automóviles
3. **Selección de calidad de stream** — ofrecer múltiples bitrates (64kbps / 128kbps / 320kbps)
4. **Offline mode** — cachear metadata y permitir reproducción offline de últimos temas escuchados
5. **Notificaciones rich** — agregar soporte para `BubbleMetadata` y notificaciones interactivas
6. **Analíticas y monitoreo** — integrar Firebase Crashlytics + Performance Monitoring
7. **Pruebas automatizadas** — agregar tests unitarios (JUnit + MockK) y UI tests (Espresso/Compose Test)

---

## 8. Roadmap

### Prioridad Alta (bugs y limpieza)

- [ ] Eliminar código muerto: iconos alternativos, temp files, mockups HTML
- [ ] Agregar `disconnect()` en conexiones HTTP de AudioService
- [ ] Extraer URLs de configuración (stream, metadata, iTunes API)
- [ ] Consolidar copias duplicadas de `logo.png`
- [ ] Mover archivos `.md` de la raíz a `docs/`
- [ ] Reemplazar `#fcad04` hardcodeado por `--accent-color` en CSS

### Prioridad Media (mejoras y estabilidad)

- [ ] Migrar Threads a Corrutinas Kotlin en AudioService
- [ ] Agregar caché de bitmaps (LruCache + disco)
- [ ] Reemplazar BitmapFactory manual por Coil
- [ ] Refactorizar singleton `companion object instance` (thread-safe)
- [ ] Persistir volumen en SharedPreferences
- [ ] Limitar SSE reconexión con max retries
- [ ] Reemplazar números mágicos por constantes
- [ ] Eliminar `values-night/themes.xml` si es redundante

### Prioridad Baja (visión a futuro)

- [ ] Evaluar migración a Jetpack Compose
- [ ] Investigar soporte Android Auto (MediaBrowserService)
- [ ] Agregar selección de calidad de stream
- [ ] Implementar modo offline básico
- [ ] Agregar Firebase Crashlytics
- [ ] Escribir tests unitarios (JUnit + MockK)
- [ ] Escribir tests UI (Espresso)

---

## 9. Conclusión

**Radio Sonido Celestial** es una aplicación híbrida funcional y bien estructurada que logra su objetivo principal: transmitir audio en vivo con una interfaz atractiva (tema dorado/oscuro, glassmorphism, visualizador animado) y reproducción confiable en segundo plano.

### Fortalezas
- Stack tecnológico moderno y apropiado (ExoPlayer/Media3, Material 3, core-splashscreen)
- Arquitectura clara de puente WebView ↔ Nativo via `@JavascriptInterface`
- Buena gestión de permisos (Android 13+ notifications, foreground service)
- Visualmente pulida con identidad de marca consistente
- CI/CD funcional con GitHub Actions (lint + build automático)

### Debilidades
- Código muerto acumulado (5 drawables no referenciados, archivos temporales, mockups HTML)
- Fugas de recursos de red en AudioService (`HttpURLConnection` sin `disconnect()`)
- 18 archivos markdown en la raíz que dificultan la navegación del proyecto
- URLs hardcodeadas en múltiples lugares
- Patrón singleton thread-unsafe en `AudioService.instance`
- Sin pruebas automatizadas

### Veredicto
La aplicación está lista para uso en producción desde el punto de vista funcional, pero requiere una limpieza de código muerto y corrección de las fugas de recursos antes de considerar un release estable (v1.0). Las mejoras de mediano/largo plazo (corrutinas, Coil, persistencia de volumen) elevarían significativamente la calidad del código y la experiencia del usuario.

---
*Reporte generado el 5 de junio de 2026. Basado en análisis estático del código fuente.*
