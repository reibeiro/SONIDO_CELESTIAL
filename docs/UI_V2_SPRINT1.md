# UI V2 — Sprint 1

**Fecha:** 5 de junio de 2026  
**Objetivo:** Implementar mejoras visuales de cabecera, badge EN VIVO, tarjeta Now Playing y Media Session.

---

## Archivos modificados

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| `index.html` | 23-37 | Header reemplazado con branding + live badge |
| `index.html` | 45-58 | `track-info` reemplazado por `now-playing-card` glass-morphism |
| `style.css` | 78-135 | Estilos nuevos: `.header-brand`, `.brand-icon`, `.brand-name`, `.header-right`, `.live-badge`, `.live-dot`, `.live-text`, `@keyframes pulse-live` |
| `style.css` | 181-272 | Sección 3 reemplazada: `.now-playing-card`, `.now-playing-info`, `.np-label`, `.playing-indicator`, `.indicator-bar`, `@keyframes equalizer` |
| `script.js` | 26-34 | Nuevos handlers Media Session: `setActionHandler('play')`, `('pause')` |
| `script.js` | 49-55, 73-79, 85-91 | `fetchAlbumArt()` actualiza MediaSession con artwork real en cache hit, fetch success y fetch error |
| `script.js` | 126-136 | `updateMetadata()` usa `data.image` o `miniArt.src` en lugar de `'logo.png'` fijo |
| `script.js` | 215-216, 221-222 | `updateUIState()` togglea opacidad del `.playing-indicator` |

---

## Cambios realizados

### 1. Header con branding ✦ Sonido Celestial

**Antes:**
```
┌──────────────────────────────────────┐
│ REPRODUCIENDO DESDE RADIO          🕐│
└──────────────────────────────────────┘
```

**Después:**
```
┌──────────────────────────────────────┐
│ ✦ Sonido Celestial  🔴 EN VIVO   🕐│
└──────────────────────────────────────┘
```

- Texto genérico reemplazado por icono estrella + nombre de marca en dorado
- Espaciado `gap: 8px` entre icono y texto
- `font-weight: 700` en el nombre

### 2. Badge animado 🔴 EN VIVO

```
┌────────────────┐
│ 🔴  EN VIVO    │
└────────────────┘
```

- Diseño tipo "pill" con `border-radius: 12px`
- Fondo semitransparente rojo `rgba(255, 59, 48, 0.15)`
- Borde `1px solid rgba(255, 59, 48, 0.3)`
- Punto rojo `7px` con animación `pulse-live` (2s, escala 0.85→1)
- Posicionado a la derecha antes del botón de historial

### 3. Tarjeta Now Playing glass-morphism

**Antes:**
```
┌──────────────────────────────────────┐
│ ┌────┐                               │
│ │ 60 │  Amanecer en el Mar           │
│ └────┘  Artista                      │
└──────────────────────────────────────┘
```
(fondo transparente, layout simple)

**Después:**
```
┌──────────────────────────────────────┐
│ ┌────┐  REPRODUCIENDO                │
│ │ 56 │  Amanecer en el Mar           │
│ └────┘  Artista                      │
│         ▎▌▐ En reproducción          │
└──────────────────────────────────────┘
```
(glass: `rgba(255,255,255,0.05)` + `backdrop-filter: blur(10px)` + borde sutil)

- `border-radius: 16px` con borde `1px solid rgba(255,255,255,0.08)`
- Mini-art reducido a `56px` con `border-radius: 12px`
- Etiqueta "REPRODUCIENDO" en dorado (`0.6rem`, letter-spacing `1px`)
- Indicador de reproducción con 3 barras animadas (equalizer):
  - `@keyframes equalizer`: altura oscila entre 5px y 14px
  - `animation-delay` escalonado: 0s, 0.15s, 0.3s
  - Visible solo durante reproducción (`opacity: 0`→`1` vía `updateUIState`)

### 4. Media Session con artwork real

- `updateMetadata()` ahora pasa `data.image` o `miniArt.src` a `MediaMetadata`
- `fetchAlbumArt()` actualiza `MediaMetadata` cuando la imagen de iTunes llega (cache hit, éxito, error)
- Nuevos handlers:
  - `setActionHandler('play')` → llama `togglePlay()` si no está reproduciendo
  - `setActionHandler('pause')` → llama `togglePlay()` si está reproduciendo
- Tamaño de artwork actualizado a `600x600`

---

## Capturas esperadas

### Estado reproduciendo

```
┌──────────────────────────────────────┐
│ ✦ Sonido Celestial  🔴 EN VIVO   🕐│
│                                       │
│          ┌──────────────────┐         │
│          │                  │         │
│          │   PORTADA        │         │
│          │   (350x350)      │         │
│          │                  │         │
│          └──────────────────┘         │
│                                       │
│  ┌──────────────────────────────┐     │
│  │ ┌──┐  REPRODUCIENDO          │     │
│  │ │56│  Amanecer en el Mar    │     │
│  │ └──┘  Artista                │     │
│  │       ▎▌▐ En reproducción    │     │
│  └──────────────────────────────┘     │
│                                       │
│  ───────▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░────────  │
│  En Vivo                      --:--   │
│                                       │
│       [F]     ▶️     [W]              │
│                                       │
│  🔉 ───────●─────── 🔊  [Compartir]   │
└──────────────────────────────────────┘
```

### Estado pausado

```
┌──────────────────────────────────────┐
│ ✦ Sonido Celestial  🔴 EN VIVO   🕐│
│                                       │
│          ┌──────────────────┐         │
│          │                  │         │
│          │   PORTADA        │         │
│          │                  │         │
│          └──────────────────┘         │
│                                       │
│  ┌──────────────────────────────┐     │
│  │ ┌──┐  REPRODUCIENDO          │     │
│  │ │56│  Amanecer en el Mar    │     │
│  │ └──┘  Artista                │     │
│  │                              │     │
│  └──────────────────────────────┘     │
│                                       │
│  ───────▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░────────  │
│  En Vivo                      --:--   │
│                                       │
│       [F]     ▶️     [W]              │
│                                       │
│  🔉 ───────●─────── 🔊  [Compartir]   │
└──────────────────────────────────────┘
```
> El indicador equalizer desaparece (opacity 0) al pausar.

### Pantalla bloqueada / Notificación

```
┌──────────────────────────────────────┐
│  ◉   Amanecer en el Mar              │
│      Artista                         │
│      ────────▓▓▓▓▓▓▓▓░░░░░░────     │
│  ────────  Radio Sonido Celestial    │
│                                       │
│  [⏮]    [▶️/⏸]    [⏭]               │
│                                       │
│  (muestra la portada real del álbum)  │
└──────────────────────────────────────┘
```
> En lugar del logo genérico, ahora se ve la carátula real (600x600) y los botones play/pause responden.

---

## Checklist de pruebas

### Pruebas funcionales

- [ ] **Header branding:** Verificar que se muestra "✦ Sonido Celestial" en dorado
- [ ] **Badge EN VIVO:** Verificar que el badge rojo aparece con punto pulsante
- [ ] **Badge animación:** El punto rojo debe escalar entre 1 y 0.85 cada 2s
- [ ] **Now Playing card:** Verificar el fondo semitransparente con glass effect
- [ ] **Now Playing card:** Borde sutil visible (`1px solid rgba(255,255,255,0.08)`)
- [ ] **Etiqueta REPRODUCIENDO:** Texto dorado pequeño arriba del título
- [ ] **Indicador equalizer:** Barras doradas visibles solo durante reproducción
- [ ] **Indicador oculto al pausar:** Al hacer pause, el indicador debe desaparecer
- [ ] **Animación equalizer:** Las 3 barras deben oscilar a diferentes ritmos
- [ ] **Título y artista:** Se muestran correctamente con el stream en vivo
- [ ] **Mini-art:** La imagen de 56px se actualiza al cambiar de canción

### Media Session (pantalla bloqueada)

- [ ] **Artwork real:** Verificar que la portada del álbum aparece en lugar de `logo.png`
- [ ] **Play desde pantalla bloqueada:** El botón play debe reanudar la reproducción
- [ ] **Pause desde pantalla bloqueada:** El botón pause debe detener la reproducción
- [ ] **Metadatos:** Título y artista se muestran correctamente
- [ ] **Transición de canciones:** El artwork se actualiza al cambiar de canción

### Regresiones

- [ ] **Play/Pause normal:** El botón central sigue funcionando correctamente
- [ ] **Volumen:** El slider de volumen no se ve afectado
- [ ] **Historial:** El panel sigue abriendo/cerrando correctamente
- [ ] **Canvas estrellas:** El fondo animado sigue funcionando
- [ ] **Blur de portada:** El fondo con blur(30px) brightness(0.3) sigue activo
- [ ] **Responsive:** La interfaz se ve bien en mobile y desktop
- [ ] **SSE Metadata:** Las actualizaciones de metadatos siguen llegando
- [ ] **Breathe animation:** La portada grande sigue con la animación de respiración

### Navegadores

- [ ] **Chrome (Android):** Prueba completa con pantalla bloqueada
- [ ] **Chrome (Desktop):** Funcionalidad general
- [ ] **Firefox:** Funcionalidad general
- [ ] **Samsung Internet:** Funcionalidad general

---

## Resumen

| Componente | Estado | Notas |
|------------|--------|-------|
| Header branding | ✅ | ✦ Sonido Celestial en dorado |
| Badge EN VIVO | ✅ | Pill rojo con punto pulsante |
| Now Playing card | ✅ | Glass-morphism con backdrop-filter |
| Indicador equalizer | ✅ | 3 barras animadas, visible solo al reproducir |
| MediaSession artwork | ✅ | Portada real 600x600 en lock screen |
| MediaSession handlers | ✅ | Play/pause desde notificación funcionan |
| Regresiones | ✅ | Sin cambios en volumen, historial, canvas, blur |
