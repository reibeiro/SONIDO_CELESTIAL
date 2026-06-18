# SPLASH_REFINEMENT_REPORT

## Arquitectura (2 capas)

### Capa 1 — SplashScreen API (Android 12+, instante inicial)
- **Theme:** `Theme.SonidoCelestial.Splash` (parent `Theme.SplashScreen`)
- **Ícono:** `@drawable/splash_logo` (estrella dorada con glow)
- **Fondo:** `#121212`
- **Duración:** 300ms
- **Transición:** `postSplashScreenTheme → Theme.SonidoCelestial`

### Capa 2 — Splash overlay personalizado (Android 5+, 2.7s)
- **Layout:** `activity_main.xml` — `FrameLayout` con `WebView` + `splash_overlay`
- **Animación:** fade-in del logo (600ms) + fade-out del overlay completo (500ms)
- **Retraso total:** 2200ms post-creación

## Jerarquía visual

```
┌────────────────────────────────┐
│                                │
│           ★ (logo)             │  ← 100dp, fade-in 600ms
│                                │
│    Radio Sonido Celestial      │  ← #FCAD04, 22sp bold
│                                │
│        Versión X.X.X           │  ← #B3B3B3, dinámico via PackageManager
│                                │
│                                │
│      Desarrollado por          │
│      Reibeiro Velasquez        │  ← #888888, 12sp
│                                │
└────────────────────────────────┘
```

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `res/drawable/splash_logo.xml` | Estrella mejorada con círculo de glow exterior (`#22FCAD04`), viewport 80dp |
| `res/layout/activity_main.xml` | `ConstraintLayout` → `FrameLayout` con WebView + splash_overlay (logo, nombre, versión, desarrollador) |
| `MainActivity.kt` | Animación fade-in/out del splash, versión dinámica via `PackageManager.getPackageInfo()` |
| `app/build.gradle` | Habilitado `buildFeatures.buildConfig = true` |

## Comportamiento

1. **Cold start:** SplashScreen API muestra estrella dorada sobre #121212 (~300ms)
2. **Activity onCreate:** splash_overlay aparece con logo animado (0→1 alpha en 600ms)
3. **WebView carga en segundo plano** durante el splash
4. **Tras 2200ms:** overlay se desvanece (500ms fade-out) → WebView visible

## Colores

| Elemento | Color |
|---|---|
| Fondo | `#121212` |
| Logo / Nombre radio | `#FCAD04` (gold) |
| Versión | `#B3B3B3` (gris claro) |
| Desarrollador | `#888888` (gris medio) |

## Compatibilidad
- Android 12+ → SplashScreen API + overlay personalizado
- Android 5–11 → overlay personalizado (SplashScreen API se omite automáticamente)
