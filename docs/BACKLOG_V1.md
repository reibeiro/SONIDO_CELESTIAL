# BACKLOG TÉCNICO v1.0

**Proyecto:** Radio Sonido Celestial  
**Origen:** `REPORTE_AUDITORIA_V1.md`  
**Estrategia:** Una tarea por vez, sin romper la aplicación en funcionamiento.

---

## Leyenda

| Prioridad | Significado |
|-----------|-------------|
| **P0** | Urgente — debe hacerse antes de cualquier otra cosa |
| **P1** | Alta — debe hacerse pronto |
| **P2** | Media — debe hacerse cuando sea posible |
| **P3** | Baja — mejora futura |

---

## FASE 0 — Correcciones críticas (P0)

> Estas tareas evitan crashes en runtime y vulnerabilidades explotables.
> Ninguna debe omitirse.

---

### TASK-001 — Agregar null-check en elementos DOM críticos

| Campo | Valor |
|-------|-------|
| **Descripción** | Agregar guardias `if (!elemento) return;` para `playBtn`, `historyPanel`, `historyList`, `songTitleEl`, `artistNameEl`, `miniArt` y `shareBtn` antes de cualquier acceso a sus propiedades o métodos. El crash más probable es `playBtn.querySelector('i')` si el botón de play no existe en el DOM. |
| **Archivo afectado** | `script.js` (líneas 2-7, 16-19, 204-208, 261, 284) |
| **Prioridad** | **P0** |
| **Tiempo estimado** | 30 minutos |
| **Dependencias** | Ninguna |
| **Criterios de aceptación** | - `playBtn` evaluado antes de `playBtn.querySelector`<br>- Cada `getElementById` usado tiene su correspondiente null-check antes del primer acceso a propiedad<br>- Si un elemento no existe, la función retorna sin lanzar TypeError<br>- La app no se rompe en ningún escenario de elementos faltantes |

---

### TASK-002 — Deshabilitar acceso a archivos en WebView

| Campo | Valor |
|-------|-------|
| **Descripción** | Agregar `webSettings.setAllowFileAccess(false)` y `webSettings.setAllowContentAccess(false)` en `onCreate` después de obtener `webSettings`. Esto evita que una vulnerabilidad XSS en el JS pueda leer archivos internos del dispositivo Android. |
| **Archivo afectado** | `MainActivity.java` (línea 22-25) |
| **Prioridad** | **P0** |
| **Tiempo estimado** | 15 minutos |
| **Dependencias** | Ninguna |
| **Criterios de aceptación** | - Las dos llamadas existen después de `myWebView.getSettings()`<br>- La app carga y reproduce correctamente (los assets locales se siguen cargando porque `file:///android_asset/` no depende de `allowFileAccess`)<br>- `setAllowFileAccess(false)` no afecta la carga de `index.html` desde assets |

---

### TASK-003 — Validar Intents con PackageManager

| Campo | Valor |
|-------|-------|
| **Descripción** | En `shouldOverrideUrlLoading`, antes de lanzar `startActivity(intent)`, verificar con `getPackageManager().queryIntentActivities(intent, 0)` que exista al menos una actividad capaz de manejar el Intent. Si no hay ninguna, retornar `true` (bloquear en WebView) en lugar de lanzar una ActivityNotFoundException. |
| **Archivo afectado** | `MainActivity.java` (líneas 47-55) |
| **Prioridad** | **P0** |
| **Tiempo estimado** | 30 minutos |
| **Dependencias** | Ninguna |
| **Criterios de aceptación** | - Enlaces `whatsapp://`, `tel://`, `mailto://` funcionan si hay apps instaladas<br>- Enlaces sin resolvedor no lanzan `ActivityNotFoundException` ni crash<br>- Enlaces `http://` y `https://` se manejan dentro del WebView (sin cambio de comportamiento)<br>- Si no hay actividad disponible, se retorna `true` y el WebView muestra un error de navegación en lugar de crashear |

---

### TASK-004 — Sanitizar albumArt en renderHistory

| Campo | Valor |
|-------|-------|
| **Descripción** | Aplicar `escapeHtml()` al valor `item.albumArt` antes de inyectarlo en `<img src="...">` dentro de `renderHistory()`. Actualmente `title` y `artist` se sanean pero `albumArt` no. Usar la misma función `escapeHtml` existente (línea 279). |
| **Archivo afectado** | `script.js` (línea 269) |
| **Prioridad** | **P0** |
| **Tiempo estimado** | 15 minutos |
| **Dependencias** | Ninguna |
| **Criterios de aceptación** | - `item.albumArt` pasa por `escapeHtml()` antes de inyectarse en el template string<br>- Imágenes con URLs válidas se siguen cargando correctamente<br>- Un valor malicioso como `" onerror="alert(1)"` se escapa a entidades HTML y no se ejecuta |

---

## FASE 1 — Seguridad (P1)

> Estas tareas cierran vectores de ataque adicionales y estabilizan conexiones de red.

---

### TASK-005 — Agregar Content-Security-Policy

| Campo | Valor |
|-------|-------|
| **Descripción** | Agregar `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; img-src 'self' https: data:; media-src 'self' https:; connect-src 'self' https:;">` en el `<head>` de index.html. Esto restringe qué recursos puede cargar la página. |
| **Archivo afectado** | `index.html` (entre líneas 13 y 14) |
| **Prioridad** | **P1** |
| **Tiempo estimado** | 30 minutos |
| **Dependencias** | TASK-004 (seguridad de inyección previa) |
| **Criterios de aceptación** | - La página carga correctamente (incluyendo Font Awesome, Google Fonts, logo, stream)<br>- La consola no muestra errores de CSP<br>- Las carátulas de iTunes (https) se cargan sin bloqueo<br>- El stream de audio (https) se reproduce sin bloqueo<br>- La conexión SSE a Zeno FM funciona<br>- Si se intenta cargar un recurso de un dominio no permitido, el navegador lo bloquea y muestra warning |

---

### TASK-006 — Bloquear popups automáticos en WebView

| Campo | Valor |
|-------|-------|
| **Descripción** | Agregar `webSettings.setJavaScriptCanOpenWindowsAutomatically(false)` después de la configuración existente del WebView. Esto evita que scripts maliciosos abran ventanas emergentes sin interacción del usuario. |
| **Archivo afectado** | `MainActivity.java` (línea 22-25) |
| **Prioridad** | **P1** |
| **Tiempo estimado** | 10 minutos |
| **Dependencias** | TASK-002 (WebView hardening previo) |
| **Criterios de aceptación** | - La línea está agregada después de `getSettings()`<br>- La funcionalidad actual de la app no se ve afectada<br>- `window.open()` desde JS no abre ventanas automáticamente |

---

### TASK-007 — Implementar reconnect exponencial en SSE

| Campo | Valor |
|-------|-------|
| **Descripción** | Reemplazar el `setTimeout(fetchMetadata, 5000)` fijo por un algoritmo de backoff exponencial: primer reintento a 5s, luego 10s, 20s, 40s, máximo 60s. Resetear el contador cuando la conexión se establece exitosamente. Usar una variable `retryDelay` fuera de la función. |
| **Archivo afectado** | `script.js` (líneas 113-117) |
| **Prioridad** | **P1** |
| **Tiempo estimado** | 1 hora |
| **Dependencias** | TASK-001 (null-check previo para evitar errores en cadena) |
| **Criterios de aceptación** | - El primer reintento ocurre a los 5 segundos<br>- Los reintentos siguen la secuencia: 5, 10, 20, 40, 60, 60... segundos<br>- Cuando la conexión SSE se establece (recibe un mensaje), el delay se resetea a 5s<br>- No hay reintentos acumulativos ni múltiples conexiones simultáneas<br>- `eventSource.close()` se llama antes de cada reconexión<br>- La funcionalidad de metadata sigue funcionando correctamente |

---

### TASK-008 — Separar CDNs del cache install del Service Worker

| Campo | Valor |
|-------|-------|
| **Descripción** | Dividir el array `ASSETS` en dos grupos: assets locales (los que se cachean en `install` con `cache.addAll`) y assets remotos (Font Awesome, Google Fonts) que se cachean en el evento `fetch` con estrategia "network first, cache fallback". Así, si un CDN falla durante install, el Service Worker no se descarta. |
| **Archivo afectado** | `service-worker.js` (completo) |
| **Prioridad** | **P1** |
| **Tiempo estimado** | 1.5 horas |
| **Dependencias** | Ninguna (es autónomo) |
| **Criterios de aceptación** | - El Service Worker se registra exitosamente aunque los CDNs no estén disponibles durante `install`<br>- Los assets locales (index.html, style.css, script.js, logo.png) se cachean en `install`<br>- Font Awesome y Google Fonts se cachean bajo demanda cuando se usan (cache-after-fetch)<br>- La app funciona offline para assets locales<br>- No hay errores de CORS al cachear CDNs externos |

---

## FASE 2 — Estabilidad y mantenibilidad (P1)

> Estas tareas eliminan código inservible y aseguran que la app no se degrada con el tiempo.

---

### TASK-009 — Eliminar botón favorito del HTML

| Campo | Valor |
|-------|-------|
| **Descripción** | Eliminar el bloque `<button class="favorite-btn">...` (líneas 42-44) de `index.html`. Este botón no tiene event listener asignado, por lo que es UI fantasma que confunde al usuario. |
| **Archivo afectado** | `index.html` (líneas 42-44) |
| **Prioridad** | **P1** |
| **Tiempo estimado** | 10 minutos |
| **Dependencias** | Ninguna |
| **Criterios de aceptación** | - El botón de corazón no aparece en la UI<br>- El layout se ajusta correctamente sin ese elemento (los elementos adyacentes se reacomodan con flexbox)<br>- No hay errores en consola<br>- La funcionalidad de la app no se ve afectada |

---

### TASK-010 — Eliminar icono chevron invisible del header

| Campo | Valor |
|-------|-------|
| **Descripción** | Eliminar la línea `<i class="fas fa-chevron-down" style="opacity: 0;"></i>` (línea 23). Era un spacer visual sin funcionalidad. Ajustar el header si es necesario para mantener el balance visual. |
| **Archivo afectado** | `index.html` (línea 23) |
| **Prioridad** | **P1** |
| **Tiempo estimado** | 10 minutos |
| **Dependencias** | Ninguna |
| **Criterios de aceptación** | - El icono invisible no aparece en el DOM<br>- El header mantiene su estructura de tres columnas (título centrado, botón historial a la derecha)<br>- No hay cambios visuales notables |

---

### TASK-011 — Eliminar visualizer-bars oculto

| Campo | Valor |
|-------|-------|
| **Descripción** | Eliminar la línea `<div class="visualizer-bars" style="display:none;"></div>` (línea 89) de `index.html`. Es un elemento oculto permanente que nunca se usa ni se referencia en JS. |
| **Archivo afectado** | `index.html` (línea 89) |
| **Prioridad** | **P1** |
| **Tiempo estimado** | 5 minutos |
| **Dependencias** | Ninguna |
| **Criterios de aceptación** | - El div oculto no aparece en el DOM<br>- No hay cambios visuales ni funcionales |

---

### TASK-012 — Eliminar comentarios de refactor anteriores

| Campo | Valor |
|-------|-------|
| **Descripción** | Eliminar los comentarios `<!-- Removed old social-share div as buttons moved up -->` (línea 86) y `<!-- Hidden elements kept for logic if needed, or visualizer -->` (línea 88). Son artefactos de refactors pasados. |
| **Archivo afectado** | `index.html` (líneas 86, 88) |
| **Prioridad** | **P1** |
| **Tiempo estimado** | 5 minutos |
| **Dependencias** | TASK-011 (eliminar visualizer-bars, que está entre estos comentarios) |
| **Criterios de aceptación** | - Los comentarios no aparecen en el HTML<br>- No hay cambios funcionales |

---

### TASK-013 — Eliminar clases CSS no usadas

| Campo | Valor |
|-------|-------|
| **Descripción** | Eliminar del archivo `style.css` las siguientes reglas no utilizadas: `.social-share` (líneas 308-312), `.social-btn` (líneas 314-325), `@keyframes slideUpFade` (líneas 328-338), `.animate-entrance` (líneas 340-343), `.delay-1` (líneas 345-347), `.delay-2` (349-351), `.delay-3` (353-355), `.delay-4` (357-359). |
| **Archivo afectado** | `style.css` (líneas 308-359) |
| **Prioridad** | **P1** |
| **Tiempo estimado** | 15 minutos |
| **Dependencias** | Ninguna |
| **Criterios de aceptación** | - Las 8 reglas CSS no existen en el archivo<br>- No hay errores de CSS en consola<br>- El layout y diseño visual no cambian<br>- No hay elementos en el DOM que usen estas clases (verificado) |

---

### TASK-014 — Eliminar permiso WAKE_LOCK del manifest

| Campo | Valor |
|-------|-------|
| **Descripción** | Eliminar la línea `<uses-permission android:name="android.permission.WAKE_LOCK" />` del `AndroidManifest.xml`. Este permiso se declara pero nunca se adquiere en el código Java, por lo que es código muerto. |
| **Archivo afectado** | `AndroidManifest.xml` (línea 6) |
| **Prioridad** | **P1** |
| **Tiempo estimado** | 5 minutos |
| **Dependencias** | Ninguna |
| **Criterios de aceptación** | - El permiso `WAKE_LOCK` no aparece en el manifest<br>- La app compila sin errores<br>- La funcionalidad no se ve afectada (nunca se usaba) |

---

### TASK-015 — Cachear selector album-art-wrapper en variable

| Campo | Valor |
|-------|-------|
| **Descripción** | Reemplazar las dos llamadas a `document.querySelector('.album-art-wrapper')` en `updateUIState` (líneas 155 y 159) con una variable cacheada declarada al inicio del closure, junto a las demás referencias DOM. |
| **Archivo afectado** | `script.js` (líneas 2-8 y 151-161) |
| **Prioridad** | **P1** |
| **Tiempo estimado** | 15 minutos |
| **Dependencias** | TASK-001 (null-check previo para el elemento cacheado) |
| **Criterios de aceptación** | - `querySelector('.album-art-wrapper')` se ejecuta una sola vez al cargar la página<br>- El valor se guarda en una constante (`albumArtWrapper`)<br>- `updateUIState` usa la variable cacheada en lugar de consultar el DOM<br>- La animación de "playing" (breathe) sigue funcionando correctamente |

---

### TASK-016 — Agregar memoria caché para iTunes API

| Campo | Valor |
|-------|-------|
| **Descripción** | Crear un `Map<string, string>` llamado `albumArtCache` fuera de `fetchAlbumArt`. Antes de hacer el fetch a iTunes, verificar si el query ya está en caché. Si está, usar el valor cacheado directamente. Si no, hacer el fetch y guardar el resultado en el map. |
| **Archivo afectado** | `script.js` (líneas 25-51) |
| **Prioridad** | **P1** |
| **Tiempo estimado** | 1 hora |
| **Dependencias** | TASK-001 (null-check previo) |
| **Criterios de aceptación** | - La misma canción reproducida dos veces solo dispara un fetch a iTunes<br>- El caché funciona dentro de la misma sesión (se pierde al recargar, lo cual es aceptable)<br>- Las carátulas se siguen mostrando correctamente<br>- Si el caché tiene un resultado "no encontrado", también se cachea (para no repetir queries sin resultados)<br>- No hay memory leak (el Map no crece indefinidamente; opcional: limitar a 50 entradas) |

---

### TASK-017 — Sincronizar assets con Android manualmente

| Campo | Valor |
|-------|-------|
| **Descripción** | Después de aplicar todos los cambios de las tareas anteriores (TASK-001 a TASK-016), copiar manualmente los archivos `index.html`, `style.css`, `script.js`, `manifest.json` y `logo.png` desde la raíz del proyecto a `android_app/app/src/main/assets/`. Esto es un paso temporal hasta tener un script de build automatizado (TASK-023). |
| **Archivo afectado** | `android_app/app/src/main/assets/*` (múltiples archivos) |
| **Prioridad** | **P1** |
| **Tiempo estimado** | 10 minutos |
| **Dependencias** | TASK-009 a TASK-016 (todos los cambios web deben estar hechos primero) |
| **Criterios de aceptación** | - Los 5 archivos en `assets/` tienen el mismo contenido que los archivos fuente en la raíz<br>- El diff entre cada par de archivos es cero<br>- La app Android compila y funciona con los nuevos assets |

---

## FASE 3 — Rendimiento (P2)

> Estas tareas mejoran la fluidez en dispositivos de gama baja y reducen el consumo de batería.

---

### TASK-018 — Pausar canvas starfield cuando no es visible

| Campo | Valor |
|-------|-------|
| **Descripción** | Usar `document.hidden` o el evento `visibilitychange` para pausar/reanudar el loop de `requestAnimationFrame` del canvas. Cuando la pestaña no es visible (usuario cambia de app o minimiza), el canvas no necesita renderizar 60fps. Guardar el ID del `requestAnimationFrame` para poder cancelarlo con `cancelAnimationFrame`. |
| **Archivo afectado** | `script.js` (líneas 349-355 y agregar event listener) |
| **Prioridad** | **P2** |
| **Tiempo estimado** | 1 hora |
| **Dependencias** | TASK-001 (null-check para canvas) |
| **Criterios de aceptación** | - Cuando la pestaña está oculta, `animateStars` no se ejecuta<br>- Cuando la pestaña se muestra de nuevo, la animación se reanuda exactamente donde estaba<br>- No hay fugas de `requestAnimationFrame` (el ID se cancela correctamente)<br>- La animación sigue siendo fluida cuando la pestaña está visible<br>- Consumo de CPU/GPU se reduce cuando la app está en background |

---

### TASK-019 — Reducir intensidad del blur background

| Campo | Valor |
|-------|-------|
| **Descripción** | Cambiar `filter: blur(80px) brightness(0.4)` a `filter: blur(30px) brightness(0.3)` en `style.css`. El blur de 80px es innecesariamente costoso. Un blur de 30px mantiene el efecto visual de fondo abstracto con mucho menos cómputo de GPU. |
| **Archivo afectado** | `style.css` (línea 53) |
| **Prioridad** | **P2** |
| **Tiempo estimado** | 15 minutos (incluye prueba visual) |
| **Dependencias** | Ninguna |
| **Criterios de aceptación** | - El fondo con blur sigue viéndose suave y abstracto (no se distingue la imagen original)<br>- La transición entre canciones sigue siendo fluida<br>- El rendimiento en WebView Android mejora (medible con DevTools Performance tab)<br>- No hay artifacts visuales (bordes duros, color shifts extraños) |

---

### TASK-020 — Agregar debounce al resize del canvas

| Campo | Valor |
|-------|-------|
| **Descripción** | Envolver el event listener de `window.resize` en un `debounce` de 200ms para evitar que `initStars()` se ejecute múltiples veces durante una animación de resize o rotación. Implementar una función `debounce(fn, delay)` simple o usar `setTimeout`/`clearTimeout`. |
| **Archivo afectado** | `script.js` (líneas 358-361) |
| **Prioridad** | **P2** |
| **Tiempo estimado** | 30 minutos |
| **Dependencias** | Ninguna |
| **Criterios de aceptación** | - Durante un resize continuo, `initStars` solo se ejecuta una vez, 200ms después del último evento<br>- Al rotar el dispositivo, las estrellas se reinician correctamente<br>- No hay estrellas con posiciones fuera del canvas visible<br>- El rendimiento del resize mejora notablemente |

---

### TASK-021 — Mejorar renderizado del historial con append

| Campo | Valor |
|-------|-------|
| **Descripción** | Cambiar `renderHistory()` para que no destruya y reconstruya todo el `innerHTML` cuando se añade una nueva canción. En lugar de eso, crear el nuevo elemento `<div class="history-item">` con `document.createElement` y usar `insertBefore` para agregarlo al principio de la lista. Mantener el full-render solo para cuando se abre el panel. |
| **Archivo afectado** | `script.js` (líneas 234-247 y 260-277) |
| **Prioridad** | **P2** |
| **Tiempo estimado** | 1.5 horas |
| **Dependencias** | TASK-001 (null-check para historyList) |
| **Criterios de aceptación** | - Cuando suena una nueva canción y el panel está abierto, solo se inserta un nuevo elemento al inicio<br>- No se recrean los elementos existentes (no hay parpadeo en la lista)<br>- Cuando se abre el panel, se sigue haciendo full-render con todos los elementos (para refrescar timestamps)<br>- El scroll position se mantiene si el usuario estaba viendo items anteriores<br>- No hay memory leaks con los elementos creados |

---

### TASK-022 — Eliminar 100vh redundante del CSS

| Campo | Valor |
|-------|-------|
| **Descripción** | En las reglas de `body` y `.player-container`, eliminar la propiedad `height: 100vh` y mantener solo `min-height: 100dvh` / `height: 100dvh`. `100dvh` (dynamic viewport height) es el estándar moderno y maneja correctamente las barras de navegación móviles. |
| **Archivo afectado** | `style.css` (líneas 19-20 y 63-64) |
| **Prioridad** | **P2** |
| **Tiempo estimado** | 15 minutos |
| **Dependencias** | Ninguna |
| **Criterios de aceptación** | - La app ocupa toda la pantalla en dispositivos móviles (con y sin notch)<br>- No hay espacios en blanco debajo del contenido<br>- En dispositivos de escritorio, la altura se ajusta correctamente<br>- No hay problemas de layout al abrir/cerrar el teclado virtual<br>- Los navegadores que no soportan `dvh` tienen un fallback adecuado |

---

## FASE 4 — Calidad y automatización (P2)

> Estas tareas mejoran el proceso de build y la calidad del código.

---

### TASK-023 — Crear script de sincronización de assets

| Campo | Valor |
|-------|-------|
| **Descripción** | Crear un script (PowerShell `.ps1` o Node.js `.js`) que copie automáticamente los archivos `index.html`, `style.css`, `script.js`, `manifest.json`, `logo.png` y `favicon.ico` desde la raíz del proyecto a `android_app/app/src/main/assets/`. El script debe mostrar un diff de los archivos que se copian. |
| **Archivo afectado** | Nuevo archivo: `sync-assets.ps1` (o `sync-assets.js`) |
| **Prioridad** | **P2** |
| **Tiempo estimado** | 1 hora |
| **Dependencias** | Ninguna |
| **Criterios de aceptación** | - El script existe en la raíz del proyecto<br>- Al ejecutarlo, copia los archivos web a `assets/`<br>- Muestra qué archivos se copiaron y si hubo cambios<br>- No copia archivos si no han cambiado (opcional, nice-to-have)<br>- Se ejecuta correctamente en Windows PowerShell |

---

### TASK-024 — Habilitar minificación en build release

| Campo | Valor |
|-------|-------|
| **Descripción** | Cambiar `minifyEnabled false` a `minifyEnabled true` en `build.gradle` (línea 21). Agregar reglas ProGuard básicas para mantener las clases de AndroidX y WebView. El archivo `proguard-rules.pro` ya existe pero puede estar vacío; agregar las reglas estándar. |
| **Archivo afectado** | `build.gradle` (línea 21) y `proguard-rules.pro` |
| **Prioridad** | **P2** |
| **Tiempo estimado** | 1 hora (incluye prueba de build release) |
| **Dependencias** | TASK-017 (assets sincronizados primero) |
| **Criterios de aceptación** | - `gradlew assembleRelease` compila exitosamente<br>- El APK release tiene tamaño reducido vs debug<br>- La app funciona correctamente en un dispositivo físico con el APK release<br>- No hay ClassNotFoundException ni MethodNotFoundException en runtime<br>- Las reglas ProGuard permiten el funcionamiento del WebView |

---

### TASK-025 — Migrar compileOptions a Java 11

| Campo | Valor |
|-------|-------|
| **Descripción** | Cambiar `sourceCompatibility JavaVersion.VERSION_1_8` y `targetCompatibility JavaVersion.VERSION_1_8` a `VERSION_11` en `build.gradle` (líneas 26-27). Java 11 ofrece mejor rendimiento y características de lenguaje como `var`, `List.of()`, etc. |
| **Archivo afectado** | `build.gradle` (líneas 26-27) |
| **Prioridad** | **P2** |
| **Tiempo estimado** | 15 minutos |
| **Dependencias** | Ninguna |
| **Criterios de aceptación** | - `gradlew assembleDebug` compila exitosamente<br>- La app funciona correctamente en dispositivos con API 24+<br>- No hay errores de compatibilidad con las dependencias de AndroidX |

---

### TASK-026 — Migrar onBackPressed a OnBackPressedDispatcher

| Campo | Valor |
|-------|-------|
| **Descripción** | Reemplazar el método deprecado `onBackPressed()` por el uso de `OnBackPressedDispatcher` con `addCallback`. En lugar de sobrescribir `onBackPressed`, registrar un callback en `onCreate` que maneje la navegación hacia atrás del WebView. |
| **Archivo afectado** | `MainActivity.java` (líneas 59-66 y onCreate) |
| **Prioridad** | **P2** |
| **Tiempo estimado** | 1 hora |
| **Dependencias** | TASK-002 y TASK-003 (WebView hardening previo) |
| **Criterios de aceptación** | - Al presionar "back" cuando el WebView tiene historial, navega hacia atrás<br>- Al presionar "back" cuando el WebView está en la raíz, cierra la app<br>- No hay warning de método deprecado en el build<br>- Compatible con API 24+ (minSdk) |

---

### TASK-027 — Agregar ESLint y Stylelint al proyecto

| Campo | Valor |
|-------|-------|
| **Descripción** | Inicializar `npm` en la raíz del proyecto (si no existe). Instalar `eslint` con configuración básica para JavaScript y `stylelint` para CSS. Agregar scripts `lint:js` y `lint:css` en `package.json`. No es necesario arreglar todos los warnings iniciales, solo tener la herramienta configurada y ejecutable. |
| **Archivo afectado** | Nuevos: `package.json`, `.eslintrc.json`, `.stylelintrc.json` |
| **Prioridad** | **P2** |
| **Tiempo estimado** | 2 horas |
| **Dependencias** | Ninguna |
| **Criterios de aceptación** | - `npm run lint:js` ejecuta ESLint sin errores de configuración<br>- `npm run lint:css` ejecuta Stylelint sin errores de configuración<br>- Los archivos de configuración están en la raíz del proyecto<br>- Los linters reportan problemas reales del código existente (si los hay) |

---

### TASK-028 — Agregar GitHub Actions para lint + build

| Campo | Valor |
|-------|-------|
| **Descripción** | Crear el directorio `.github/workflows/` y un archivo `ci.yml` que ejecute: lint de JS, lint de CSS, y build de Android (debug) en cada push y pull request a la rama principal. Usar `actions/setup-java@v3` con JDK 17 y `gradle/gradle-build-action@v2`. |
| **Archivo afectado** | Nuevo: `.github/workflows/ci.yml` |
| **Prioridad** | **P2** |
| **Tiempo estimado** | 1.5 horas |
| **Dependencias** | TASK-027 (ESLint y Stylelint configurados) |
| **Criterios de aceptación** | - El workflow se ejecuta en GitHub Actions al hacer push<br>- Ejecuta lint de JS y CSS<br>- Ejecuta `gradlew assembleDebug`<br>- Reporta el resultado (pass/fail) en el PR<br>- El tiempo de ejecución total es menor a 10 minutos |

---

## FASE 5 — Arquitectura (P3)

> Estas tareas son mejoras estructurales a largo plazo. No bloquean el funcionamiento actual.

---

### TASK-029 — Evaluar viabilidad del wrapper Android vs PWA

| Campo | Valor |
|-------|-------|
| **Descripción** | Realizar un análisis comparativo entre mantener el wrapper Android (WebView) vs. eliminar la app nativa y recomendar solo la PWA instalable. Considerar: Google Play Store policies, funcionalidad offline, capacidad de notificaciones, reproducción en background, y esfuerzo de mantenimiento. Documentar la decisión en un ADR (Architecture Decision Record). |
| **Archivo afectado** | Ninguno (nuevo documento: `ADR-001-pwa-vs-webview.md`) |
| **Prioridad** | **P3** |
| **Tiempo estimado** | 2 días (investigación y documento) |
| **Dependencias** | Todas las tareas anteriores (para tener una base limpia antes de decidir) |
| **Criterios de aceptación** | - Documento ADR creado con pros y contras de cada opción<br>- Análisis de Google Play Store policies (riesgo de rechazo)<br>- Recomendación clara y justificada<br>- Si se decide mantener el wrapper, plan de migración a Kotlin + funcionalidad nativa |

---

### TASK-030 — Agregar reproducción en background (Foreground Service)

| Campo | Valor |
|-------|-------|
| **Descripción** | Si se decide mantener la app Android, implementar un `Foreground Service` que permita la reproducción de audio cuando la app está en background. Esto requiere migrar la reproducción de audio del WebView a un `MediaPlayer` o `ExoPlayer` nativo, con una notificación persistente con controles de playback. |
| **Archivo afectado** | Múltiples: nuevo `AudioService.java`, `AndroidManifest.xml`, `MainActivity.java`, recursos de notificación |
| **Prioridad** | **P3** |
| **Tiempo estimado** | 2-3 semanas |
| **Dependencias** | TASK-029 (decisión sobre el wrapper Android) |
| **Criterios de aceptación** | - El audio sigue reproduciéndose cuando el usuario minimiza la app<br>- Hay una notificación en la barra de estado con controls (play/pause, cerrar)<br>- La notificación muestra el título de la canción y el logo<br>- Al volver a la app, el estado está sincronizado<br>- Funciona en Android 8+ (API 26+) |

---

### TASK-031 — Migrar a ExoPlayer para streaming de audio

| Campo | Valor |
|-------|-------|
| **Descripción** | Integrar ExoPlayer (ahora Media3) para manejar el streaming de audio desde el lado nativo, en lugar del elemento `<audio>` HTML del WebView. Esto permite mejor manejo de buffers, soporte de formatos, y reproducción en background. Requiere comunicación Java ↔ JS via JavascriptInterface. |
| **Archivo afectado** | Múltiples: `build.gradle` (dependencias), `MainActivity.java`, `AudioService.java`, `script.js` (JavascriptInterface) |
| **Prioridad** | **P3** |
| **Tiempo estimado** | 3-4 semanas |
| **Dependencias** | TASK-030 (Foreground Service como base) |
| **Criterios de aceptación** | - El stream de audio se reproduce via ExoPlayer en lugar del elemento `<audio>`<br>- La metadata se sigue actualizando desde el JS<br>- El volumen se controla desde la UI Web (sync con el player nativo)<br>- Mejor manejo de errores de red y reconexión automática<br>- Menor latencia de inicio de reproducción |

---

### TASK-032 — Migrar a Kotlin

| Campo | Valor |
|-------|-------|
| **Descripción** | Migrar `MainActivity.java` a Kotlin. Esto incluye: convertir la sintaxis Java a Kotlin, aprovechar las features del lenguaje (null safety, corrutinas, extension functions), y actualizar el `build.gradle` para soportar Kotlin. La migración puede ser progresiva (Java y Kotlin coexistiendo). |
| **Archivo afectado** | `MainActivity.java` → `MainActivity.kt`, `build.gradle` (plugin Kotlin) |
| **Prioridad** | **P3** |
| **Tiempo estimado** | 1 semana |
| **Dependencias** | TASK-025 (Java 11 como paso intermedio) |
| **Criterios de aceptación** | - `MainActivity.kt` existe y es funcionalmente equivalente a la versión Java<br>- El build compila exitosamente con el plugin de Kotlin<br>- La app funciona igual que antes<br>- Se aprovecha al menos una feature de Kotlin (null safety, scope functions) |

---

## Resumen del backlog

| Fase | Prioridad | Tareas | Esfuerzo total |
|------|-----------|--------|----------------|
| **Fase 0** — Correcciones críticas | P0 | 4 | ~1.5 horas |
| **Fase 1** — Seguridad | P1 | 4 | ~3.5 horas |
| **Fase 2** — Estabilidad y mantenibilidad | P1 | 8 | ~3 horas |
| **Fase 3** — Rendimiento | P2 | 5 | ~4 horas |
| **Fase 4** — Calidad y automatización | P2 | 6 | ~7 horas |
| **Fase 5** — Arquitectura | P3 | 4 | ~7-8 semanas |

**Total: 31 tareas** | **Esfuerzo total estimado (Fases 0-4): ~19 horas**

### Orden de ejecución recomendado

```
TASK-001  →  TASK-002  →  TASK-003  →  TASK-004     (Fase 0, orden crítico)
     │
     ▼
TASK-005  →  TASK-006  →  TASK-007  →  TASK-008     (Fase 1, orden seguro)
     │
     ▼
TASK-009  →  TASK-010  →  TASK-011  →  TASK-012     (Fase 2, limpieza HTML)
     │
     ▼
TASK-013  →  TASK-014  →  TASK-015  →  TASK-016     (Fase 2, limpieza CSS/JS)
     │
     ▼
TASK-017                                         (sincronizar assets Android)
     │
     ▼
TASK-018  →  TASK-019  →  TASK-020  →  TASK-021  →  TASK-022     (Fase 3)
     │
     ▼
TASK-023  →  TASK-024  →  TASK-025  →  TASK-026  →  TASK-027  →  TASK-028  (Fase 4)
     │
     ▼
TASK-029  →  TASK-030  →  TASK-031  →  TASK-032                  (Fase 5, opcional)
```

Cada tarea puede ejecutarse de forma independiente. Las dependencias están explicitadas para evitar conflictos.
