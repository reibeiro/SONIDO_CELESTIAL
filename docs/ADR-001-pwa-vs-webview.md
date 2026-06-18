# ADR-001: PWA vs Android WebView Wrapper

**Estado:** Propuesto
**Fecha:** 2026-06-05
**Contexto:** Radio Sonido Celestial funciona actualmente como PWA (instalable desde navegador) y como app Android nativa (WebView wrapper). Ambas cargan el mismo código web (`index.html`, `style.css`, `script.js`) y ofrecen la misma experiencia de usuario.

---

## Análisis comparativo

### 1. Capacidad instalable

| Aspecto | PWA | Android WebView |
|---------|-----|----------------|
| Instalación | "Add to Home Screen" (Chrome, Edge, Firefox) | APK manual o Play Store |
| Descubrimiento | Solo navegador | Play Store / sideload |
| Tamaño instalado | ~5 MB (caché navegador) | ~4 MB APK |
| Update automático | Sí, Service Worker | Nuevo APK |

### 2. Funcionalidad offline

| Aspecto | PWA | Android WebView |
|---------|-----|----------------|
| Cache estático | Service Worker cachea assets locales | No cachea (carga de assets locales desde APK) |
| Cache de contenido | No (streaming) | No (streaming) |

Ambas tienen el mismo comportamiento offline: los assets locales se muestran sin conexión, pero el stream de audio necesita red. **Sin ventaja para ninguna.**

### 3. Notificaciones push

| Aspecto | PWA | Android WebView |
|---------|-----|----------------|
| Push API | Sí (con Service Worker + VAPID) | Sí (FCM) |
| Complejidad | Media (sin backend propio) | Alta (Firebase, servidor) |

La PWA puede enviar notificaciones push sin servidor propio vía servicios como OneSignal. El wrapper Android requiere Firebase Cloud Messaging. **Ventaja: PWA.**

### 4. Reproducción en background

| Aspecto | PWA | Android WebView |
|---------|-----|----------------|
| Background audio | Limitado (pestaña activa) | Foreground Service necesario (TASK-030) |
| Lock screen controls | Media Session API | Notificación persistente |

La PWA con Media Session API muestra controles en el lock screen en Android. Sin embargo, algunas versiones de Chrome pueden cerrar el audio en background tras unos minutos. El wrapper Android podría evitarlo con un Foreground Service, pero **eso requiere migrar el audio a ExoPlayer nativo (TASK-031)**.

**Ventaja marginal: Android WebView (solo si se implementa TASK-030 + TASK-031).**

### 5. Rendimiento

| Aspecto | PWA | Android WebView |
|---------|-----|----------------|
| Arranque | Instantáneo (caché SW) | ~500ms (carga WebView + assets) |
| Consumo RAM | ~80 MB (Chrome) | ~60 MB (WebView) |
| Renderizado | Chrome (V8 + Blink) | WebView (mismo motor) |
| GPU | Chrome comparte GPU | WebView comparte GPU |

Son prácticamente equivalentes. El WebView no ofrece ninguna ventaja de rendimiento real porque la app ya es 100% HTML/CSS/JS en ambos casos.

### 6. Mantenimiento

| Aspecto | PWA | Android WebView |
|---------|-----|----------------|
| Código a mantener | 3 archivos + manifest + SW | Todo lo anterior + Java + Gradle + XML + resources |
| Build tooling | Ninguno | Gradle, Android SDK, JDK |
| CI/CD | Opcional | GitHub Actions (ya configurado) |
| Fragilidad | Ninguna | SDK updates, Gradle versiones, dependencias AndroidX |

**Ventaja significativa: PWA.** El wrapper Android agrega ~5 archivos + toolchain sin aportar valor funcional.

### 7. Google Play Store

| Aspecto | PWA | Android WebView |
|---------|-----|----------------|
| Política | No requiere | Requiere cumplimiento de políticas |
| Riesgo de rechazo | N/A | Medio: Google puede rechazar WebViews que solo envuelven contenido web (sección "Webviews" de Play policy) |
| Monetización | No integrada | Google Play Console |

**Riesgo real:** Google Play Store prohíbe explícitamente "apps whose primary functionality is to provide a webview of a website not owned or administered by you". Si bien el contenido es propio, el riesgo de que un revisor clasifique esta app como "wrapper web" es no trivial. La política requiere "sufficient native functionality or unique content". Actualmente la app tiene 0 funcionalidad nativa — es un wrapper puro.

---

## Recomendación

**Eliminar el wrapper Android y migrar completamente a PWA.**

### Justificación

1. **Cero valor añadido actual:** El wrapper no agrega ninguna funcionalidad que la PWA no tenga. Es código muerto que debe mantenerse.
2. **Riesgo Play Store:** Una app sin funcionalidad nativa puede ser rechazada o removida de Play Store bajo la política de "webviews".
3. **Costo de mantenimiento:** Cada cambio en el frontend requiere sincronizar assets (TASK-023 fue creada precisamente por esto). El gradle, manifest, resources, y toolchain son responsabilidad adicional sin beneficio.
4. **Reproducción en background:** Si se necesita en el futuro, la Media Session API de la PWA cubre el caso básico. Para reproducción prolongada sin pestaña visible, implementar un Foreground Service requiere migrar todo el audio a nativo (semanas de trabajo) — esfuerzo desproporcionado para una radio en vivo.
5. **Usuarios:** La mayoría de usuarios accede vía navegador en mobile (link directo, Facebook, WhatsApp). La PWA es instalable y ofrece la misma experiencia.

### Plan de migración propuesto

1. No publicar ni distribuir más el APK Android.
2. Mantener los archivos Android en el repo como referencia (no eliminarlos inmediatamente).
3. Agregar al README instrucciones para instalar la PWA ("Add to Home Screen").
4. Evaluar si en el futuro se desea una app nativa real (con ExoPlayer, Foreground Service, notificaciones) — en ese caso, migrar a Kotlin con funcionalidad nativa genuina, no un WebView wrapper.

### Alternativa (Plan B)

Si se decide mantener el wrapper Android:
- Migrar a Kotlin (TASK-032)
- Implementar Foreground Service con ExoPlayer (TASK-030 + TASK-031)
- Publicar en Play Store como app de audio con player nativo

Esto representa ~4-6 semanas de desarrollo, pero al menos la app tendría funcionalidad nativa real que justifica su existencia en Play Store.

---

## Decisión

**Pendiente** — requiere aprobación del equipo.
