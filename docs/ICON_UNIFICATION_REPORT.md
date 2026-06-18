# ICON_UNIFICATION_REPORT

## Decisión de diseño

El `favicon.ico` de la raíz del proyecto (originalmente un círculo de 32×32px) no puede usarse directamente en Android por su baja resolución. Se creó un **icono vectorial unificado** basado en la identidad "Sonido Celestial": un **disco dorado con estrella interior**, que representa la marca en todos los contextos Android sin pérdida de calidad.

## Icono oficial

**Diseño:** Disco dorado (`#FCAD04`) con aro interior oscuro (`#121212`) y estrella dorada central — símbolo celestial que identifica la radio.

**Formato:** `VectorDrawable` (XML) — resolución infinita, sin pixelación, compatible con Android 5+.

## Archivos creados

| Archivo | Uso | Descripción |
|---|---|---|
| `res/drawable/ic_launcher_foreground.xml` | Launcher (Android 8+) | Vector 108dp: disco + anillo + estrella en dorado |
| `res/drawable/splash_logo.xml` | Splash Screen (API + overlay) | Vector 80dp: mismo diseño |
| `res/drawable/ic_notification.xml` | Notificación small icon | Misma estrella en blanco (`#FFFFFF`) sobre 24dp |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `res/values/themes.xml` | `windowSplashScreenAnimatedIcon`: `@drawable/logo` → `@drawable/splash_logo` (nuevo vector) |
| `res/layout/activity_main.xml` | `ImageView src`: `@drawable/logo` → `@drawable/splash_logo` (nuevo vector) |

## Archivos eliminados

| Archivo | Razón |
|---|---|
| `res/mipmap-mdpi/ic_launcher_foreground.webp` | Reemplazado por vector en `drawable/` |
| `res/mipmap-hdpi/ic_launcher_foreground.webp` | Reemplazado por vector en `drawable/` |
| `res/mipmap-xhdpi/ic_launcher_foreground.webp` | Reemplazado por vector en `drawable/` |
| `res/mipmap-xxhdpi/ic_launcher_foreground.webp` | Reemplazado por vector en `drawable/` |
| `res/mipmap-xxxhdpi/ic_launcher_foreground.webp` | Reemplazado por vector en `drawable/` |

## Recursos reutilizados (sin cambios)

| Recurso | Ubicación | Uso |
|---|---|---|
| `favicon.ico` | Raíz del proyecto | Web (navegador/PWA) |
| `logo.png` | `res/drawable/logo.png` + Web Assets | Interfaz principal WebView |
| `res/values/ic_launcher_background.xml` | `#121212` | Fondo del adaptive icon |
| Launcher `.webp` legacy (`ic_launcher`, `ic_launcher_round`) | mipmap-{mdpi..xxxhdpi} | Fallback Android < 8 |

## Arquitectura final de iconos

```
favicon.ico (Web/PWA)
  └── logo.png (WebView UI)

VectorDrawable unificado (Android nativo)
  ├── ic_launcher_foreground.xml (108dp, disco+estrella dorado)
  │     └── Adaptive Icon: background #121212 + foreground
  ├── splash_logo.xml (80dp, mismo diseño)
  │     └── SplashScreen API + overlay personalizado
  └── ic_notification.xml (24dp, estrella blanca)
        └── Notification small icon
```

## Notas

- Los launcher legacy `.webp` (Android < 8) se conservan como están — muestran el icono anterior en dispositivos muy antiguos (< 5% de usuarios activos).
- Para actualizarlos, se necesita regenerar PNGs desde logo.png (1024×1024) y convertirlos a `.webp`.
- El vector `ic_launcher_foreground.xml` pesa ~1KB y cubre todas las densidades sin réplicas.
