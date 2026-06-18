# PLAN_UI_ANDROID_WEB_V2 — Integración Completa

## Resumen del estado actual

### Web (después de Sprint 1)
- **Header:** ✦ Sonido Celestial + 🔴 EN VIVO badge animado ✓
- **Now Playing:** Glass-morphism card con equalizer + label REPRODUCIENDO ✓
- **Controles:** 3 botones en línea (FB, Play/Pause, WA) + slider volumen + share
- **MediaSession Web:** Metadata actualizada con artwork real + handlers play/pause
- **Canvas:** Starfield + blur(30px) brightness(0.3) desde portada

### Android (después de Sprint 1)
- **Splash Screen:** `installSplashScreen()` + estrella dorada (#121212 bg)
- **Tema:** Material 3 DarkTheme con paleta gold brand
- **Icono adaptativo:** Estrella gold sobre fondo oscuro
- **Dynamic Colors:** `DynamicColors.applyToActivityIfAvailable()`
- **Notificación:** LargeIcon con artwork (fetcheado desde iTunes API internamente)
- **Sin MediaSession nativa** → la pantalla bloqueada no muestra controles nativos

---

## Problemas detectados

| # | Problema | Capa | Impacto |
|---|----------|------|---------|
| 1 | Android no tiene MediaSession nativa | Android | No se ve artwork en pantalla bloqueada; controles lock screen no responden |
| 2 | Album art URL no se pasa web→Android | Sincro | Android hace fetch duplicado de iTunes en vez de usar la URL que web ya tiene |
| 3 | Notificación sin decoración MediaStyle avanzada | Android | No muestra metadatos expandidos |
| 4 | Controles web planos (FB/WA flanquean play) | Web | Jerarquía visual pobre |
| 5 | Sin gradiente animado en barra de progreso | Web | La barra al 100% se ve estática |
| 6 | Sin edge-to-edge real en Android | Android | WebView no ocupa área de status/nav bar |

---

## Plan de cambios

### FASE 1 — Sincronizar Web → Android (album art + metadata)

#### script.js (Web)

| Línea | Cambio |
|-------|--------|
| 138-141 | `Android.updateMetadata(title, artist)` → `Android.updateMetadata(title, artist, artUrl)` |
| 186-187 | `Android.play(url, title, artist)` → `Android.play(url, title, artist, albumArtUrl)` |
| Nueva función | `getCurrentArtUrl()` que retorna `miniArt.src` |

**Detalle:** El flujo actual obtiene `artUrl` en `fetchAlbumArt()` y también en `updateMetadata()`. Se debe pasar ese URL al bridge Android para que no tenga que refetchear de iTunes.

```javascript
// Antes (línea 140):
if (isAndroid()) Android.updateMetadata(title, artist);
// Después:
const artUrlToSend = data.image || (miniArt ? miniArt.src : '');
if (isAndroid()) Android.updateMetadata(title, artist, artUrlToSend);
```

#### RadioInterface.kt (Android)

| Línea | Cambio |
|-------|--------|
| 34 | `updateMetadata(title, artist)` → `updateMetadata(title, artist, albumArt)` con `@JvmOverloads` para compat JS |
| 11 | `play(url, title, artist)` → `play(url, title, artist, albumArt)` con `@JvmOverloads` |
| Nuevo | Extraer `EXTRA_ALBUM_ART` y pasarlo al Intent |

**Detalle:** Se usa `@JvmOverloads` para que JavaScript (que solo pasa 2 params en `updateMetadata`) siga funcionando. El nuevo parámetro `albumArt` tiene default `""`.

```kotlin
@JvmOverloads
@JavascriptInterface
fun updateMetadata(title: String, artist: String, albumArt: String = "") {
    val intent = Intent(context, AudioService::class.java).apply {
        action = AudioService.ACTION_UPDATE_METADATA
        putExtra(AudioService.EXTRA_TITLE, title)
        putExtra(AudioService.EXTRA_ARTIST, artist)
        putExtra(AudioService.EXTRA_ALBUM_ART, albumArt)
    }
    startServiceSafely(intent)
}
```

#### AudioService.kt (Android) — MediaSession nativa

| Línea | Cambio |
|-------|--------|
| Nuevas imports | `MediaSession` (media3), `MediaMetadata`, `SessionCommands` |
| Nuevo campo | `private var mediaSession: MediaSession? = null` |
| 46-56 (onCreate) | Crear `MediaSession.Builder(this, exoPlayer)` y configurar conectividad |
| 59-82 (onStartCommand) | En ACTION_UPDATE_METADATA: parsear `EXTRA_ALBUM_ART`, actualizar MediaSession metadata |
| 86-90 (onDestroy) | Liberar `mediaSession` |
| 210-240 (fetchAlbumArt) | Si `EXTRA_ALBUM_ART` no está vacío, usarlo directamente en vez de iTunes |
| 164-208 (buildNotification) | Agregar `setSubText()` con "Radio Sonido Celestial", mejorar estilo |

**Detalle:** Se agrega `androidx.media3:media3-session:1.3.1` a build.gradle. `MediaSession` se conecta al `ExoPlayer` automáticamente. Cuando `updateMetadata` recibe un `EXTRA_ALBUM_ART`, actualiza `MediaMetadata` del session, y el sistema lo refleja en la pantalla bloqueada.

```kotlin
import androidx.media3.session.MediaSession
import androidx.media3.common.MediaMetadata as Media3Metadata

// En onCreate():
mediaSession = MediaSession.Builder(this, exoPlayer!!)
    .setSessionActivity(openIntent)
    .build()

// Al actualizar metadata:
val metadata = Media3Metadata.Builder()
    .setTitle(currentTitle)
    .setArtist(currentArtist)
    .setArtworkBitmap(currentAlbumArtBitmap)
    .build()
exoPlayer?.setMediaMetadata(metadata)
```

### FASE 2 — Mejorar visualmente la Web

#### index.html

| Línea | Cambio |
|-------|--------|
| 70-87 (controls-main) | Separar sociales de play: social-row arriba, play-row abajo |
| 89-96 (volume) | Mantener pero con mejor espaciado |
| Nuevo | Agregar wrapper `controls-wrapper` para mejor organización |

**Estructura nueva de controles:**
```html
<!-- Social Row (más pequeño, arriba) -->
<div class="social-row">
    <a class="social-btn" href="..."><i class="fab fa-facebook-f"></i> Facebook</a>
    <a class="social-btn" href="..."><i class="fab fa-whatsapp"></i> WhatsApp</a>
</div>

<!-- Main Controls Row (play, grande, centro) -->
<div class="controls-row">
    <button id="play-pause-btn" class="play-btn primary">...</button>
</div>

<!-- Volume + Share Row -->
<div class="volume-row">
    ...
</div>
```

#### style.css

| Línea | Cambio |
|-------|--------|
| 304-357 (controls) | Reemplazar con `social-row`, `controls-row`, `volume-row` |
| 274-302 (progress) | Agregar gradiente animado tipo shimmer al `.progress-fill` |
| Nuevo | `.social-btn` con estilo badge, texto label |
| Nuevo | `@keyframes shimmer` para la barra de progreso |
| 181-272 | Refinar espaciado de now-playing-card |
| 69-76 | Ajustar `margin-bottom` del header |

**Progress bar shimmer:**
```css
.progress-fill {
    background: linear-gradient(90deg, 
        var(--accent-color), 
        #ffd700, 
        var(--accent-color));
    background-size: 200% 100%;
    animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
}
```

### FASE 3 — Mejorar Android nativo

#### AudioService.kt — MediaSession completa

```kotlin
// Dependencia nueva: media3-session (build.gradle línea 47)
implementation 'androidx.media3:media3-session:1.3.1'

// En AudioService.onCreate():
val openIntent = PendingIntent.getActivity(
    this, 0,
    Intent(this, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
    },
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
)

mediaSession = MediaSession.Builder(this, exoPlayer!!)
    .setSessionActivity(openIntent)
    .build()

// En onDestroy():
mediaSession?.release()
mediaSession = null

// Al recibir EXTRA_ALBUM_ART:
private fun updateMediaSessionMetadata(title: String, artist: String, bitmap: Bitmap?) {
    val metadata = Media3Metadata.Builder()
        .setTitle(title)
        .setArtist(artist)
        .apply { if (bitmap != null) setArtworkBitmap(bitmap) }
        .build()
    exoPlayer?.setMediaMetadata(metadata)
}
```

**Relación Capital:** `Media3Metadata` es de `androidx.media3.common.MediaMetadata`, diferente de `MediaMetadata` de web MediaSession API.

#### AudioService.kt — Notificación mejorada

```kotlin
// En buildNotification():
.setSubText("Radio Sonido Celestial")  // Línea sutil debajo del artista
.setStyle(androidx.media.app.NotificationCompat.MediaStyle()
    .setShowActionsInCompactView(0)
    .setShowCancelButton(true)
    .setCancelButtonIntent(cancelIntent))
// Añadir colorAccent para el icono
.setColor(0xFFFCAD04.toInt())
```

#### MainActivity.kt — Edge-to-edge + transparencia

| Línea | Cambio |
|-------|--------|
| 34 | Reemplazar `FLAG_LAYOUT_NO_LIMITS` con `WindowCompat.setDecorFitsSystemWindows(window, false)` |
| Nueva | `ViewCompat.setOnApplyWindowInsetsListener()` para padding |

```kotlin
import androidx.core.view.WindowCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

// Reemplazar línea 34:
WindowCompat.setDecorFitsSystemWindows(window, false)

// Después de setContentView:
ViewCompat.setOnApplyWindowInsetsListener(myWebView) { v, insets ->
    val statusBar = insets.getInsets(WindowInsetsCompat.Type.statusBars())
    v.setPadding(0, statusBar.top, 0, 0)
    insets
}
```

### FASE 4 — activity_main.xml refinamiento

| Línea | Cambio |
|-------|--------|
| 2-14 | Agregar `fitsSystemWindows="true"` en WebView, `android:background="#121212"` |

```xml
<WebView
    android:id="@+id/webview"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#121212" />
```

---

## Correspondencia Web ↔ Android

| Cambio Web | Cambio Android equivalente |
|------------|---------------------------|
| Now Playing card (glass-morphism) | Notificación multimedia mejorada (subText, estilo, artwork) |
| Progress bar shimmer (animación flujo) | MediaSession metadata animado (respuesta a cambios en vivo) |
| Controles reorganizados (social row separada) | Edge-to-edge real + status bar integrada |
| Header + badge EN VIVO | Splash Screen + tema M3 consistente (ya implementado) |
| Album art breathe animation | Artwork bitmap en MediaSession nativa (lock screen) |
| Script pasa albumArt URL a Android | RadioInterface recibe albumArt, AudioService lo usa directo |

---

## Dependencias entre capas

```
Web (script.js)                  Android (RadioInterface)          Android (AudioService)
─────────────────                ──────────────────────            ─────────────────────
togglePlay()                                                              
  → Android.play(               → play(url, title, artist,            → ACTION_PLAY
    url, title, artist,            albumArt) @JvmOverloads                → ExoPlayer.play()
    miniArt.src)                                                          → setMediaMetadata()

updateMetadata(data)                                                   
  → parse title/artist                                                 
  → fetchAlbumArt()              → updateMetadata(title,               → ACTION_UPDATE_METADATA
  → Android.updateMetadata(        artist, albumArt)                       → exoPlayer.setMediaMetadata()
    title, artist,                @JvmOverloads                           → fetchAlbumArt() (si no hay URL)
    artUrl)                                                               → updateNotification()
```

**Flujo optimizado:**
1. Web recibe SSE con metadata (title, artist, image URL)
2. Web fetchea album art de iTunes (si no viene en SSE)
3. Web actualiza su UI (título, artista, portada, fondo blur, MediaSession web)
4. Web llama `Android.updateMetadata(title, artist, albumArtUrl)`
5. Android recibe en RadioInterface, lo pasa a AudioService vía Intent
6. AudioService:
   - Si `albumArtUrl` no es vacío → descarga bitmap rápido de esa URL (en vez de iTunes)
   - Si `albumArtUrl` es vacío → fallback a iTunes fetch (comportamiento actual)
7. AudioService actualiza: notification (LargeIcon) + MediaSession (lock screen artwork + controls)

---

## Archivos a modificar

### Web (3 archivos, ~30 líneas nuevas/modificadas)

| Archivo | Líneas a tocar | Cambios |
|---------|----------------|---------|
| `index.html` | 70-96 | Reorganizar controles en 3 filas (social, play, volume) |
| `style.css` | 274-357 | Progress shimmer + nuevos estilos social-row/volume-row |
| `script.js` | 138-141, 186-187 | Pasar `albumArtUrl` a bridge Android |

### Android (6 archivos, ~80 líneas nuevas/modificadas)

| Archivo | Líneas a tocar | Cambios |
|---------|----------------|---------|
| `RadioInterface.kt` | 11-41 | `@JvmOverloads` en play/updateMetadata, pasar EXTRA_ALBUM_ART |
| `AudioService.kt` | 1-241 | +MediaSession, recibir EXTRA_ALBUM_ART, updateMediaSessionMetadata(), notif mejorada |
| `MainActivity.kt` | 9-68 | Edge-to-edge real + insets listener |
| `activity_main.xml` | 9-12 | +`android:background="#121212"` |
| `build.gradle` | 46 | +`media3-session:1.3.1` |
| `themes.xml` | Sin cambios | Ya está correcto |

### Sin cambios (ya implementado en Sprint 1)
- `colors.xml` ✓
- `AndroidManifest.xml` ✓ (solo verificar)
- `ic_launcher_foreground.xml` ✓
- `splash_logo.xml` ✓
- `ic_notification.xml` ✓

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| `@JvmOverloads` + `@JavascriptInterface` no funciona en algunos WebView | Baja | Testear en WebView Android System (Chrome). Probar con 2 parámetros primero, luego 3 |
| MediaSession de media3 requiere API 21+ | Baja | minSdk=24, compatible |
| `WindowCompat.setDecorFitsSystemWindows` en WebView causa layout incorrecto | Media | Testear en múltiples densidades. Si falla, mantener `FLAG_LAYOUT_NO_LIMITS` |
| fetchAlbumArt duplicado (web + android) | Alta | El nuevo flujo prioriza URL recibida vía bridge; iTunes fetch es solo fallback |
| Notificación con bitmap 300x300 consume memoria | Baja | Bitmap se recicla al reemplazar. Máximo 300x300 png comprimido |
| WebView padding inset empuja contenido hacia abajo | Alta | Testear visualmente; puede necesitar ajuste de padding en el CSS también |

---

## Orden de implementación

```
1. build.gradle           → + media3-session
2. RadioInterface.kt       → @JvmOverloads, pass albumArt
3. script.js               → pass artUrl to Android bridge
4. AudioService.kt         → MediaSession + albumArt flow + notification
5. MainActivity.kt         → edge-to-edge + insets
6. activity_main.xml       → background color
7. style.css               → progress shimmer + controls restyle
8. index.html              → controls restructure
```

**Total estimado:** ~110 líneas nuevas/modificadas en 8 archivos.
