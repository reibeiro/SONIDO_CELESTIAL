# Sincronización Web ↔ Android Assets

**Fecha:** 5 de junio de 2026  

---

## Diagnóstico

Se detectó que los archivos en `android_app/app/src/main/assets/` contenían la **versión original** del proyecto, sin ninguna de las actualizaciones de Sprint 1 ni Sprint 2.

### Archivos con diferencias

| Archivo | Root (raíz) | Assets (Android) | Estado |
|---------|-------------|------------------|--------|
| `index.html` | 117 líneas — header brand, now-playing card, social/controls/volume rows | 100 líneas — header "REPRODUCIENDO DESDE RADIO", track-info, controls-main | **DESACTUALIZADO** |
| `style.css` | 581 líneas — shimmer, social-row, volume-row, indicator, now-playing-card, pulses | 443 líneas — header-title, controls-main, volume-container, track-info | **DESACTUALIZADO** |
| `script.js` | 463 líneas — MediaSession handlers, album art bridge, indicator toggle | 427 líneas — sin handlers, sin bridge, sin indicator | **DESACTUALIZADO** |

### Diferencias específicas

#### index.html
```
Assets                          → Root
─────────────────────────────────────────────────────────────────
<span class="header-title">      → <div class="header-brand">✦ Sonido Celestial
  REPRODUCIENDO DESDE RADIO"       + 🔴 EN VIVO badge animado
<div class="track-info">         → <div class="now-playing-card">
  <h2 id="song-title">             glass-morphism + equalizer indicator
  <p id="artist-name">
<div class="controls-main">      → <div class="social-row"> (FB/WA con label)
  [FB] [Play] [WA] inline        <div class="controls-row"> (play 72px)
<div class="volume-container">   → <div class="volume-row"> (share con label)
```

#### style.css
```
Assets                          → Root
─────────────────────────────────────────────────────────────────
.header-title { }               → .header-brand, .live-badge,
                                  @keyframes pulse-live
.track-info { }                 → .now-playing-card (glass-morphism)
#mini-art: 60px/8px              #mini-art: 56px/12px
.progress-fill: solid color     → .progress-fill: gradient shimmer
                                  @keyframes shimmer
.controls-main / .control-btn   → .social-row / .social-link / .social-label
.play-btn: 70px                  .play-btn: 72px / scale(0.92)
.volume-container               → .volume-row / .share-btn / .share-label
```

#### script.js
```
Assets                          → Root
─────────────────────────────────────────────────────────────────
(sin MediaSession handlers)     → setActionHandler('play') + ('pause')
MediaSession: 'logo.png' fijo   → MediaSession: msArtUrl real
Android.updateMetadata(2 params)→ updateMetadata(title, artist, artUrl)
Android.play(3 params)          → play(url, title, artist, miniArt.src)
updateUIState sin indicator     → updateUIState con indicator opacity toggle
fetchAlbumArt sin MediaSession  → fetchAlbumArt actualiza MediaSession
```

---

## Acciones realizadas

### 1. Copia manual de archivos actualizados

```
root/index.html   → assets/index.html   (117 líneas, 4991 bytes)
root/style.css    → assets/style.css    (581 líneas, 11555 bytes)
root/script.js    → assets/script.js    (463 líneas, 17731 bytes)
```

### 2. Ejecución del script de sincronización

```
PowerShell > sync-assets.ps1
Resultado: 0 copiados, 5 omitidos
```

El script reportó "no changes" porque los archivos ya estaban actualizados tras la copia manual.

### 3. Archivos verificados como sincronizados

| Archivo | Root | Assets | Coinciden |
|---------|------|--------|-----------|
| `index.html` | 4991 bytes | 4991 bytes | ✅ |
| `style.css` | 11555 bytes | 11555 bytes | ✅ |
| `script.js` | 17731 bytes | 17731 bytes | ✅ |
| `manifest.json` | — | — | ✅ (sin cambios) |
| `logo.png` | — | — | ✅ (sin cambios) |

---

## Estado final

```
┌─────────────────────────────────────────────────────────────────┐
│                    AMBAS CAPAS SINCRONIZADAS                     │
├──────────────────────────────┬──────────────────────────────────┤
│         WEB (raíz)           │        ANDROID (assets)          │
├──────────────────────────────┼──────────────────────────────────┤
│ index.html  (Sprint 2)       │ index.html  (Sprint 2) ✅        │
│ style.css   (Sprint 2)       │ style.css   (Sprint 2) ✅        │
│ script.js   (Sprint 2)       │ script.js   (Sprint 2) ✅        │
└──────────────────────────────┴──────────────────────────────────┘
```

Ahora Android cargará `file:///android_asset/index.html` con la misma interfaz que la versión web: header Sonido Celestial, badge EN VIVO, tarjeta glass-morphism, controles en 3 filas, barra shimmer, y bridge de album art hacia AudioService.
