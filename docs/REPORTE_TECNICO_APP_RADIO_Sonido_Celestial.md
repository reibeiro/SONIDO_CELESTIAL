# REPORTE TÉCNICO - Radio Sonido Celestial

---

## 1. Resumen Ejecutivo

**Descripción general del proyecto:**
Aplicación híbrida PWA + Android nativa para la reproducción de radio cristiana en streaming. La app consume el stream de Zeno.FM, muestra metadatos en tiempo real (artista/canción), obtiene carátulas desde iTunes, e incluye una sección de versículo bíblico diario. La versión Android envuelve la PWA en un WebView y utiliza un servicio nativo en Kotlin con ExoPlayer para reproducción en segundo plano con notificaciones multimedia.

**Tecnologías utilizadas:**
- **Frontend:** HTML5, CSS3, JavaScript (ES2021), PWA (Service Worker + Manifest)
- **Android:** Kotlin, Jetpack/AndroidX, ExoPlayer (Media3), WebView, MediaSession
- **Streaming:** Zeno.FM (formato MP3/AAC vía HLS o directo), EventSource (SSE) para metadatos
- **APIs externas:** iTunes Search API (carátulas), bible-api.com (versículo diario)
- **Build:** Gradle (AGP 8.13.2, Kotlin 1.9.22), GitHub Actions CI
- **Calidad:** ESLint, Stylelint

**Estado actual de la aplicación:**
- Funcional: reproducción de stream, metadatos en vivo, carátulas, versículo bíblico, visualizador de audio, fondo animado de estrellas
- Android: WebView funcional con puente JS ↔ Kotlin, servicio en foreground con ExoPlayer y notificaciones
- PWA: registra Service Worker con estrategia cache-first para assets locales y network-first para CDN
- Pendiente: no se encontraron tests automatizados, el CI solo ejecuta lint y build de Android

---

## 2. Arquitectura

### Estructura de carpetas

```
SONIDO_CELESTIAL/
├── index.html                     # PWA principal (punto de entrada web)
├── script.js                      # Lógica JS del reproductor
├── style.css                      # Estilos completos
├── service-worker.js              # Service Worker PWA
├── manifest.json                  # Manifest PWA
├── package.json                   # DevDeps ESLint + Stylelint
├── .eslintrc.json                 # Config ESLint
├── .stylelintrc.json              # Config Stylelint
├── .github/workflows/ci.yml       # Pipeline CI/CD
├── .backup_v1/                    # Backup de versión anterior (no se usa)
│   ├── index.html
│   ├── script.js
│   └── style.css
├── docs/                          # Documentación
└── android_app/
    ├── build.gradle               # Gradle proyecto raíz
    ├── settings.gradle            # Configuración de módulos
    ├── gradle.properties          # Propiedades Gradle
    ├── local.properties           # Ruta SDK local
    ├── gradle/wrapper/
    │   └── gradle-wrapper.properties
    └── app/
        ├── build.gradle           # Build del módulo app
        └── src/main/
            ├── AndroidManifest.xml
            ├── assets/            # Mirror exacto de los archivos PWA
            │   ├── index.html
            │   ├── script.js
            │   ├── style.css
            │   ├── service-worker.js
            │   ├── manifest.json
            │   └── logo.png
            ├── java/com/sonidocelestial/radio/
            │   ├── MainActivity.kt      # Activity principal con WebView
            │   ├── AudioService.kt      # Servicio de reproducción foreground
            │   └── RadioInterface.kt    # Puente JS ↔ Kotlin (@JavascriptInterface)
            └── res/
                ├── layout/activity_main.xml
                ├── drawable/
                ├── mipmap-anydpi-v26/
                ├── values/
                ├── values-night/
                └── xml/
```

### Flujo de funcionamiento

1. **Inicio:** El usuario abre la app (Android o navegador web)
2. **WebView carga PWA:** El WebView (o navegador) carga `index.html` desde assets (o servidor web)
3. **JavaScript inicializa el reproductor:**
   - Conecta vía `EventSource` al endpoint SSE de Zeno.FM para metadatos en tiempo real
   - Inicia el canvas de estrellas animadas
   - Carga el versículo bíblico del día
4. **Reproducción de audio (dos modos):**
   - **PWA (navegador):** usa elemento `<audio>` nativo de HTML5
   - **Android:** el JS llama al puente `Android.play()` que inicia `AudioService` con ExoPlayer
5. **Metadatos:** Cuando Zeno.FM envía el evento `streamTitle`, el JS parsea "Artista - Título", busca carátula en iTunes API, actualiza la UI y notifica a Android vía `Android.updateMetadata()`
6. **Control de volumen:** sincronizado bidireccionalmente entre el slider HTML y el volumen nativo de Android
7. **Historial:** se guarda en `localStorage` (máx. 50 entradas) con timestamps relativos
8. **Navegación:** bottom nav con pestañas: Inicio, Biblia, Historial, Ajustes

### Relación Android ↔ WebView ↔ JavaScript

```
┌─────────────────────────────────────────────────────────────────┐
│                       MAINACTIVITY.KT                          │
│  WebView configurado con JS habilitado                         │
│  Carga file:///android_asset/index.html                        │
│  addJavascriptInterface(RadioInterface, "Android")             │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
┌─────────────────┐             ┌──────────────────┐
│  RADIOINTERFACE │             │  AUDIOSERVICE.KT  │
│  @JavascriptInterface         │  ExoPlayer        │
│  play()          │             │  MediaSession     │
│  pause()         │             │  Notificación     │
│  setVolume()     │             │  Foreground       │
│  getVolume()     │             └──────────────────┘
│  updateMetadata()│
└────────┬────────┘
         │  Llamadas desde JS
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SCRIPT.JS                                │
│  if (typeof Android !== 'undefined') {                         │
│    Android.play(url, title, artist, albumArt)                  │
│  } else {                                                      │
│    audioElement.play()                                         │
│  }                                                             │
│  Volumen: Android.setVolume(value) vs audioElement.volume      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Análisis del Código

### Archivos principales y responsabilidades

| Archivo | Líneas | Responsabilidad |
|---------|--------|-----------------|
| `index.html` | 141 | Punto de entrada: estructura HTML con canvas, álbum, info, visualizador, navegación, versículo bíblico, historial, elemento `<audio>` oculto |
| `script.js` | 548 | Lógica completa del reproductor: stream, metadatos, carátulas, puente Android, historial, pestañas, versículo, animación de estrellas, visualizador |
| `style.css` | 885 | Todos los estilos: glassmorphism, animaciones, diseño responsive, 5 breakpoints, navegación inferior fija, modo oscuro |
| `service-worker.js` | 42 | Cacheo de assets para funcionalidad offline parcial (PWA) |
| `manifest.json` | 21 | Configuración PWA: nombre, iconos, orientación, colores |
| `MainActivity.kt` | 147 | Activity principal: splash screen, WebView, permisos de notificación, navegación historial |
| `AudioService.kt` | 357 | Servicio foreground: ExoPlayer, MediaSession, notificación, caché de carátulas, persistencia de volumen |
| `RadioInterface.kt` | 63 | Puente JS↔Kotlin: 5 métodos expuestos al WebView |
| `activity_main.xml` | 73 | Layout: WebView + overlay de splash con logo y créditos |

### Dependencias utilizadas

**Frontend (CDN):**
- Font Awesome 6.4.0 (iconos)
- Google Fonts: Outfit (tipografía)

**Android (Gradle):**
- `androidx.appcompat:appcompat:1.7.0`
- `com.google.android.material:material:1.12.0`
- `org.jetbrains.kotlin:kotlin-stdlib:1.9.22`
- `androidx.activity:activity:1.9.3`
- `androidx.core:core-ktx:1.15.0`
- `androidx.core:core-splashscreen:1.0.1`
- `androidx.media:media:1.7.0`
- `androidx.media3:media3-exoplayer:1.5.1`
- `androidx.media3:media3-ui:1.5.1`
- `androidx.media3:media3-session:1.5.1`

**Dev (npm):**
- `eslint:^8.57.0`
- `stylelint:^16.3.0`
- `stylelint-config-standard:^36.0.0`

---

## 4. Código Muerto o Innecesario

### Archivos no utilizados

| Archivo | Problema |
|---------|----------|
| `.backup_v1/` (3 archivos) | Backup de V1, no se referencia ni usa en producción. Ocupa espacio innecesario. |
| `.idea/` (carpetas en android_app y raíz) | Archivos de configuración del IDE local, no deberían estar en el repositorio |
| `logo.png` en assets/ | Se referencia en splash_icon.xml e ic_notification.xml pero no existe físicamente como `@drawable/logo` en res/drawable/ (solo como `logo.png` en assets/) |

### Funciones sin uso (o con uso dudoso)

- **`script.js` — función `getTimeAgo()`**: Se usa dentro de la función flecha en `loadHistory()`. Correcto.
- **`script.js` — variable `currentTrack`**: Se declara y actualiza pero podría optimizarse su uso.
- **CSS — `.bible-active`**: Se referencia en JS pero no parece tener estilo definido específico.
- **CSS — clases `.panel-open`**: Se usa para abrir el historial pero su estilo está parcialmente definido.

### Variables redundantes

- **`script.js` — variables `bibleNavBtn`, `homeNavBtn`, `playerContent`:** Declaradas pero nunca utilizadas. Ya fueron eliminadas.

### CSS no utilizado (o marginal)

- `style.css` contiene 885 líneas. Varias reglas parecen no tener efecto visible o están duplicadas:
  - Reglas de `.bible-active` podrían no aplicarse correctamente
  - Varias reglas de animación `@keyframes` que podrían consolidarse
  - Estilos para `.hidden` que ya existen en clases utilitarias de FontAwesome
  - Duplicación de estilos de glassmorphism en `.now-playing-card` y `.history-panel`

---

## 5. Problemas Detectados

### Errores potenciales

1. **`startForegroundService` sin verificación de permisos en Android 13+:** En `RadioInterface.kt` se lanza el servicio sin verificar que el permiso `POST_NOTIFICATIONS` esté concedido (aunque MainActivity lo solicita, no se espera la respuesta).

2. **Reconexión SSE sin jitter:** El EventSource ya tiene reconexión automática con backoff exponencial, pero sin variación aleatoria (jitter) podrían generarse picos de reconexión sincronizada. Mejorado con jitter de hasta 3s.

3. **Sin validación HTTP en fetch:** Las peticiones a iTunes API y bible-api.com no verificaban `res.ok` antes de parsear JSON. Ya corregido.

4. **Variables no usadas en script.js:** `playerContent`, `bibleNavBtn`, `homeNavBtn` estaban declaradas pero no referenciadas. Ya eliminadas.

### Problemas de rendimiento

1. **Sin debounce en el slider de volumen (corregido):** El evento `input` del volumen disparaba llamadas al puente Android en cada cambio. Se agregó debounce de 120ms.

2. **Carga completa de assets duplicados:** Los archivos PWA están duplicados en `assets/` y en la raíz. La CI los copia, pero en desarrollo hay dos copias que deben mantenerse sincronizadas manualmente.

### Problemas de estabilidad

1. **Memory leak potencial en `loadHistory()`:** Cada vez que se abre el historial se regenera el HTML interno con `innerHTML`. No hay delegación de eventos, lo que puede acumular listeners.

2. **`AudioService` como singleton con `instance` estática:** La variable `companion object { var instance: AudioService? = null }` es propensa a fugas de memoria y comportamientos inesperados si el servicio es destruido y recreado por el sistema Android.

### Problemas de mantenimiento

1. **Assets duplicados manualmente:** Los archivos en `android_app/app/src/main/assets/` son copias exactas de los de la raíz. No hay un mecanismo automático (aparte del CI) para sincronizarlos durante desarrollo.

2. **Versión de Gradle desactualizada:** Gradle 8.13-bin. AGP 8.13.2 es reciente pero Gradle wrapper usa una versión específica que podría quedar obsoleta.

3. **Sin tests automatizados:** No hay tests unitarios, de integración ni de UI en ningún nivel del proyecto.

---

## 6. Seguridad

### Riesgos de WebView

1. **JavaScript habilitado:** `webView.settings.javaScriptEnabled = true` — necesario para el funcionamiento, pero cualquier XSS en la PWA compromete toda la app Android.

2. **`mediaPlaybackRequiresUserGesture = false`:** Permite reproducción automática sin interacción del usuario. Puede ser considerado una mala práctica de UX y seguridad.

3. **`setAllowFileAccess(false)`** ✅ Correcto, reduce superficie de ataque.

4. **`setAllowContentAccess(false)`** ✅ Correcto.

### Configuraciones inseguras

1. **Network Security Config:** Permite HTTPS solo para `zeno.fm` y `itunes.apple.com`, pero no hay backup si esos dominios cambian de IP o certificado. El `onReceivedSslError` en `WebViewClient` cancela TODOS los errores SSL con `handler.proceed()` llamado condicionalmente — aunque parece que llama `handler.cancel()`, lo cual es correcto.

2. **Comunicación WebView↔Android vía `@JavascriptInterface`:** Cualquier script ejecutado en el WebView (incluyendo scripts de terceros cargados vía CDN) tiene acceso completo al puente `Android`, que puede iniciar reproducción, modificar volumen y actualizar metadatos. Esto es un riesgo si alguna CDN es comprometida.

3. **CSP restrictivo pero no absoluto:** La meta etiqueta CSP permite `cdnjs.cloudflare.com`, `fonts.googleapis.com`, `fonts.gstatic.com`. Si alguno de estos es comprometido, un atacante podría inyectar código malicioso.

### Recomendaciones

- **Añadir validación del origen** en `RadioInterface.kt` para verificar que las llamadas vienen de `file:///android_asset/`
- **Implementar Subresource Integrity (SRI)** en las etiquetas `<link>` y `<script>` de CDN
- **Usar `@JavascriptInterface` con anotación `@Keep`** y considerar agregar un mecanismo de autorización (token interno)
- **Revisar la política de CSP** para ser más restrictiva si es posible
- **Considerar `WebViewAssetLoader`** de AndroidX para servir assets locales vía HTTP en lugar de `file://`

---

## 7. Oportunidades de Mejora

### Corto plazo

1. ~~**Agregar elemento `<audio>` en `index.html`:**~~ **✅ HECHO** — Se añadió `<audio id="audioPlayer">` al HTML y se actualizó `script.js` para usarlo con fallback a `new Audio()`.
2. ~~**Mejorar reconexión del EventSource:**~~ **✅ HECHO** — Se agregó jitter aleatorio de hasta 3s a la reconexión con backoff exponencial (máx. 60s).
3. ~~**Debounce al slider de volumen:**~~ **✅ HECHO** — Se implementó debounce de 120ms para las llamadas al bridge Android.
4. ~~**Manejo de errores HTTP en fetch:**~~ **✅ HECHO** — Se agregó verificación `res.ok` en iTunes API y bible-api.com.
5. ~~**Variables no usadas:**~~ **✅ HECHO** — Se eliminaron `playerContent`, `bibleNavBtn`, `homeNavBtn`.
6. **Eliminar la carpeta `.backup_v1/`** del repositorio (está en el historial git pero se puede ignorar).

### Mediano plazo

1. **Automatizar la sincronización de assets PWA → Android** mediante un script en `package.json` (ya existe `sync` pero usa PowerShell; mejorarlo con watch mode).
2. **Agregar tests unitarios para `script.js`** usando un framework como Jest o Vitest.
3. **Implementar manejo de errores HTTP** en todas las llamadas fetch (iTunes, bible-api.com) con feedback visual.
4. **Refactorizar `AudioService`** para eliminar el singleton y usar un patrón más robusto (injección con Hilt/Dagger o manual).
5. **Mejorar la estrategia de caché del Service Worker** para incluir la respuesta del stream de metadatos cuando sea posible.

### Largo plazo

1. **Migrar a Jetpack Compose** para la UI nativa (splash, etc.) y eventualmente reemplazar el WebView con una UI nativa completa.
2. **Soporte multiplataforma** con Kotlin Multiplatform (compartir lógica de negocio entre iOS y Android).
3. **Implementar Cast SDK** para Chromecast/Google Home.
4. **Agregar analytics** para entender patrones de uso (respetando privacidad).
5. **Internacionalización** (soporte multilenguaje).

---

## 8. Roadmap

### Prioridad Alta

- [x] **BUG CRÍTICO:** Agregar elemento `<audio id="audioPlayer">` en `index.html` para que la PWA funcione correctamente en navegadores
- [x] Reconexión del EventSource con jitter aleatorio
- [x] Debounce en el slider de volumen (120ms)
- [x] Agregar manejo de errores HTTP en fetch de iTunes y bible-api.com
- [x] Eliminar variables no usadas (playerContent, bibleNavBtn, homeNavBtn)

### Prioridad Media

- [ ] Sincronización automática de assets PWA → Android (mejorar script sync)
- [ ] Tests automatizados (unitarios + integración)
- [ ] Refactorizar singleton de AudioService
- [ ] Eliminar carpeta `.backup_v1/` del repositorio
- [ ] Agregar SRI (Subresource Integrity) a recursos CDN
- [ ] Validación de origen en `RadioInterface.kt`

### Prioridad Baja

- [ ] Migración a Jetpack Compose
- [ ] Soporte Chromecast
- [ ] Internacionalización
- [ ] Analytics con privacidad
- [ ] Kotlin Multiplatform
- [ ] Optimización de CSS (eliminar reglas no usadas, consolidar animaciones)

---

## 9. Conclusión

Radio Sonido Celestial es un proyecto bien estructurado que combina una PWA moderna con una envoltura Android nativa. La arquitectura de puente JS ↔ Kotlin es correcta y permite que el WebView delegue la reproducción de audio a ExoPlayer, garantizando reproducción en segundo plano con notificaciones.

**Fortalezas:**
- Código Kotlin bien organizado con separación clara de responsabilidades
- Uso de tecnologías modernas (ExoPlayer Media3, MediaSession, splash screen API 12+)
- PWA con Service Worker y manifest para experiencia instalable
- Diseño visual atractivo con glassmorphism y animaciones
- CI/CD automatizado con GitHub Actions

**Debilidades principales:**
1. **Assets duplicados:** La PWA y los assets de Android deben sincronizarse manualmente durante desarrollo
2. **Sin tests:** Cero cobertura de tests en todo el proyecto
3. **Singleton frágil:** `AudioService.instance` es propenso a memory leaks
4. **CSS con Stylelint warnings:** ~204 issues pre-existentes (notación de color, formato, vendor prefixes)

**Recomendación:** El proyecto tiene una base sólida. Se corrigieron los issues de alta prioridad identificados en el análisis. Los siguientes pasos recomendados son: eliminar `.backup_v1/`, agregar tests automatizados, y refactorizar el singleton de `AudioService`.
