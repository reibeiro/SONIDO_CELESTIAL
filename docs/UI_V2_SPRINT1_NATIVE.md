# UI V2 — Sprint 1 Nativo (Android)

**Fecha:** 5 de junio de 2026  
**Objetivo:** Splash Screen, icono adaptativo, Material 3, color dinámico, notificación con artwork, transición de apertura y pantalla de carga nativa.

---

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `res/drawable/ic_launcher_foreground.xml` | Vector drawable — estrella dorada de 5 puntas sobre fondo oscuro para icono adaptativo |
| `res/drawable/splash_logo.xml` | Vector drawable — misma estrella en 64dp para el splash screen |
| `res/drawable/ic_notification.xml` | Vector drawable — estrella blanca 24dp para icono pequeño de notificación |
| `res/values-night/themes.xml` | Tema nocturno explícito (mismos colores oscuros, forzado siempre dark) |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `res/values/colors.xml` | + gold_primary, gold_secondary, gold_container, gold_tertiary, dark_background, dark_surface, splash_background |
| `res/values/ic_launcher_background.xml` | #000000 → #121212 (fondo oscuro para icono adaptativo) |
| `res/values/themes.xml` | Padre M3 DarkTheme, colores brand, +SplashScreen theme |
| `res/mipmap-anydpi-v26/ic_launcher.xml` | Foreground apunta a `@drawable/ic_launcher_foreground` |
| `res/mipmap-anydpi-v26/ic_launcher_round.xml` | Foreground apunta a `@drawable/ic_launcher_foreground` |
| `AndroidManifest.xml` | Iconos `@mipmap/ic_launcher`, tema Splash en activity, `enableOnBackInvokedCallback` |
| `MainActivity.kt` | `installSplashScreen()`, `DynamicColors.applyToActivityIfAvailable()`, import WindowManager |
| `AudioService.kt` | Fetch artwork desde iTunes API, LargeIcon en notificación, custom small icon |
| `app/build.gradle` | + `androidx.core:core-splashscreen:1.0.1` |

---

## 1. Splash Screen Android 12+

### Mecanismo

- **Librería:** `androidx.core:core-splashscreen:1.0.1`
- **Tema:** `Theme.SonidoCelestial.Splash` (parent `Theme.SplashScreen`)
  - `windowSplashScreenBackground`: `@color/splash_background` (#121212)
  - `windowSplashScreenAnimatedIcon`: `@drawable/splash_logo` (estrella dorada 64dp)
  - `windowSplashScreenAnimationDuration`: 300ms
  - `postSplashScreenTheme`: `@style/Theme.SonidoCelestial`
- **Código:** `installSplashScreen()` llamado antes de `super.onCreate()` en `MainActivity.kt`
- **Compatibilidad:** Funciona desde API 24 (minSdk) gracias al compat de la librería

### Flujo visual

```
1. Usuario toca icono
2. Sistema muestra splash: fondo oscuro + estrella dorada centrada
3. Splash se desvanece (300ms) al cargar el activity
4. WebView aparece con la UI de radio
```

---

## 2. Icono Adaptativo Moderno

### Estructura

```
res/
├── mipmap-anydpi-v26/
│   ├── ic_launcher.xml          → adaptive-icon (bg: color, fg: drawable)
│   └── ic_launcher_round.xml    → adaptive-icon (bg: color, fg: drawable)
├── drawable/
│   └── ic_launcher_foreground.xml → estrella 5 puntas #FCAD04
└── values/
    └── ic_launcher_background.xml → #121212
```

### Especificaciones

| Capa | Contenido | Color |
|------|-----------|-------|
| Background | Sólido (color) | #121212 (dark) |
| Foreground | Estrella 5 puntas | #FCAD04 (gold) |

### Fallback pre-API 26

Los `mipmap-*/ic_launcher.webp` y `ic_launcher_round.webp` existentes se mantienen sin cambios para dispositivos anteriores a Android 8.0.

---

## 3. Tema Material 3

### Base

Padre `Theme.Material3.DarkTheme.NoActionBar` — oscuro forzado, coincide con la UI web.

### Paleta Material 3

| Atributo | Valor | Descripción |
|----------|-------|-------------|
| `colorPrimary` | `#FCAD04` | Gold brand — botones, acentos |
| `colorOnPrimary` | `#000000` | Texto sobre primary |
| `colorPrimaryContainer` | `#33FCAD04` | Contenedores translúcidos gold |
| `colorSecondary` | `#E6A800` | Gold más oscuro |
| `colorSecondaryContainer` | `#33FCAD04` | Contenedores secundarios |
| `colorTertiary` | `#FFD700` | Gold brillante |
| `colorSurface` | `#1E1E1E` | Superficies elevadas |
| `android:colorBackground` | `#121212` | Fondo general |
| `statusBarColor` | `#121212` | Barra de estado |
| `navigationBarColor` | `#121212` | Barra de navegación |

### values-night

Se incluye `values-night/themes.xml` con el mismo estilo oscuro para evitar que el tema M3 DayNight use colores claros en modo luz.

---

## 4. Color Dinámico Android (Monet)

### Implementación

```kotlin
DynamicColors.applyToActivityIfAvailable(this)
```

- Llamado **antes** de `super.onCreate()` en `MainActivity.kt`
- En Android 12+ con wallpaper dinámico, los colores del sistema (colorPrimary, colorSecondary, etc.) se adaptan al fondo de pantalla
- En dispositivos sin soporte (pre-12 o sin wallpaper dinámico), se usa la paleta gold definida en themes.xml
- El WebView con la UI dorada de la radio no se ve afectada — solo los chrome nativos (status bar, navigation bar, dialogos, etc.)

---

## 5. Notificación Multimedia con Artwork

### Small Icon

- `R.drawable.ic_notification` — estrella blanca de 24dp
- Visible en la barra de notificaciones

### Large Icon (Album Art)

- `setLargeIcon(currentAlbumArtBitmap)` en `buildNotification()`
- El bitmap se obtiene automáticamente llamando a la **iTunes Search API** desde el servicio

### Flujo de descarga de artwork

```
1. Script JS envía título/artista a RadioInterface.updateMetadata()
2. RadioInterface envía ACTION_UPDATE_METADATA a AudioService
3. AudioService.onStartCommand() detecta ACTION_UPDATE_METADATA
4. Llama a fetchAlbumArt(artist, title)
5. fetchAlbumArt() en Thread background:
   a. Consulta iTunes: https://itunes.apple.com/search?term=artist+title&media=music&limit=1
   b. Parsea JSON, extrae artworkUrl100
   c. Reemplaza 100x100 → 300x300
   d. Descarga el bitmap vía HttpURLConnection
   e. Postea al main thread: actualiza currentAlbumArtBitmap + notifica
6. buildNotification() usa currentAlbumArtBitmap como LargeIcon
```

### Notificación MediaStyle expandida

```
┌──────────────────────────────────────┐
│ [🌟]  Amanecer en el Mar            │
│       Grupo Sonido                   │
│       ────────────────────────       │
│       [⏸]                           │
└──────────────────────────────────────┘
```

---

## 6. Transición de Apertura

### Splash → Activity

- `Theme.SonidoCelestial.Splash` configurado como tema del activity en el manifest
- `installSplashScreen()` maneja la transición automática:
  - API 31+: Animación nativa del sistema (icono se expande)
  - API 24-30: Fade del drawable personalizado al contenido
- `windowSplashScreenAnimationDuration="300"` controla la duración

---

## 7. Pantalla de Carga Nativa

La pantalla de carga es provista por el SplashScreen:

- **Fondo:** `#121212` (igual que la app)
- **Icono:** Estrella dorada centrada (splash_logo.xml)
- **Comportamiento:** Aparece instantáneamente al tocar el icono, se desvanece cuando el WebView termina de cargar su primer frame

---

## Checklist de pruebas

### Splash Screen

- [ ] Al abrir la app, se muestra fondo oscuro con estrella dorada
- [ ] La animación dura aprox. 300ms
- [ ] Transición suave del splash al contenido

### Icono Adaptativo

- [ ] Icono en home: estrella dorada sobre fondo oscuro
- [ ] Icono redondo (si el launcher lo usa) se ve correctamente
- [ ] En API 26+, se usa la versión adaptativa
- [ ] En API <26, se usa la versión webp existente

### Material 3

- [ ] Status bar y navigation bar en #121212
- [ ] Colores de acento gold visibles en componentes nativos

### Color Dinámico

- [ ] En Android 12+: los colores pueden variar según el wallpaper
- [ ] En Android <12: se usa la paleta gold estándar
- [ ] La UI web no se ve afectada por el cambio de colores

### Notificación con Artwork

- [ ] La notificación muestra el icono pequeño (estrella blanca)
- [ ] Cuando cambia la canción, la notificación se actualiza
- [ ] El artwork (portada) aparece como LargeIcon
- [ ] El artwork se actualiza al cambiar de canción
- [ ] Play/Pause desde la notificación funciona
- [ ] La notificación se muestra en la pantalla bloqueada

### Regresiones

- [ ] La reproducción de audio sigue funcionando
- [ ] El WebView carga correctamente
- [ ] El bridge JS-Android (play/pause/metadata) sigue operativo
- [ ] El historial no se ve afectado
- [ ] El volumen sigue funcionando
- [ ] Los botones sociales (Facebook/WhatsApp) siguen funcionando

---

## Resumen visual

```
┌──────────────────────────────────────┐
│          SPLASH SCREEN                │
│                                      │
│              ★                        │
│         (estrella dorada)             │
│                                      │
│        Radio Sonido Celestial         │
│                                      │
│    (se desvanece en 300ms → app)     │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  ICONO ADAPTATIVO                     │
│  ┌──────────────────────────┐         │
│  │  ╱  Fondo #121212        │         │
│  │ ★  Foreground #FCAD04    │         │
│  │  ╲  (estrella 5 puntas)  │         │
│  └──────────────────────────┘         │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  NOTIFICACIÓN MULTIMEDIA              │
│ ┌──────────────────────────────┐      │
│ │ [★]  Amanecer en el Mar      │      │
│ │      Grupo Sonido             │      │
│ │      ─────────────           │      │
│ │      [⏸]  (con portada real) │      │
│ └──────────────────────────────┘      │
└──────────────────────────────────────┘
```
