# ICON_REBUILD_REPORT

## Problema original

El launcher icon no cambió porque:
1. Los archivos `.webp` en `mipmap-*` contenían el icono antiguo.
2. El vector `drawable/ic_launcher_foreground.xml` (disco+estrella) **no se parecía al diseño real del favicon**.
3. La SplashScreen API usaba un vector (micrófono o disco+estrella) que no era el logo real.

## Solución

### Fuente
El `favicon.ico` solo contiene 3 frames (16, 32, 48 px). Para generar iconos Android nítidos se usó `logo.png` (1024×1024) — **mismo diseño, misma marca, resolución 32× superior**.

Proceso: `System.Drawing` con `HighQualityBicubic` redimensionó el logo a cada densidad requerida.

## Archivos reemplazados

### mipmap — ic_launcher (todas las densidades)

| Archivo | Tamaño anterior | Tamaño nuevo |
|---|---|---|
| `res/mipmap-mdpi/ic_launcher.webp` | (old webp) | 3.6 KB — 48×48 px |
| `res/mipmap-hdpi/ic_launcher.webp` | (old webp) | 6.1 KB — 72×72 px |
| `res/mipmap-xhdpi/ic_launcher.webp` | (old webp) | 9.2 KB — 96×96 px |
| `res/mipmap-xxhdpi/ic_launcher.webp` | (old webp) | 16.0 KB — 144×144 px |
| `res/mipmap-xxxhdpi/ic_launcher.webp` | (old webp) | 23.8 KB — 192×192 px |

### mipmap — ic_launcher_round (mismas densidades, mismo contenido)

Archivos `ic_launcher_round.webp` regenerados como copia del launcher estándar.

### mipmap — ic_launcher_foreground (para Adaptive Icon)

| Archivo | Tamaño | Dimensión |
|---|---|---|
| `res/mipmap-mdpi/ic_launcher_foreground.webp` | 10.8 KB | 108×108 px |
| `res/mipmap-hdpi/ic_launcher_foreground.webp` | 18.8 KB | 162×162 px |
| `res/mipmap-xhdpi/ic_launcher_foreground.webp` | 28.0 KB | 216×216 px |
| `res/mipmap-xxhdpi/ic_launcher_foreground.webp` | 48.4 KB | 324×324 px |
| `res/mipmap-xxxhdpi/ic_launcher_foreground.webp` | 72.3 KB | 432×432 px |

### drawable — vector eliminado

| Archivo | Acción |
|---|---|
| `res/drawable/ic_launcher_foreground.xml` | Eliminado — reemplazado por raster `@mipmap/ic_launcher_foreground` |

### mipmap-anydpi-v26 — XMLs actualizados

| Archivo | Cambio |
|---|---|
| `ic_launcher.xml` | foreground: `@drawable/...` → `@mipmap/ic_launcher_foreground` |
| `ic_launcher_round.xml` | foreground: `@drawable/...` → `@mipmap/ic_launcher_foreground` |

### ic_launcher_background — sin cambios

`res/values/ic_launcher_background.xml` = `#121212` (dark). No se modificó.

## Resumen visual

| Componente | Antes | Ahora |
|---|---|---|
| Launcher icon (Android < 8) | WebP antiguo (logo previo) | **Logo real redimensionado** |
| Adaptive icon (Android 8+) | Vector disco+estrella (no coincidía) | **Logo real vía @mipmap foreground** |
| SplashScreen API | Vector disco+estrella / micrófono | **Logo real vía @drawable/splash_logo** |
| Splash overlay | Logo real | **Logo real** (sin cambios) |
| Notification icon | Estrella blanca vectorial | **Estrella blanca vectorial** (sin cambios) |

## Build verificado

`gradlew clean assembleDebug` → **BUILD SUCCESSFUL** (29s, 38 tasks ejecutadas)

Iconos confirmados dentro del APK: 17 entries en `res/mipmap-*`.
