# VOLUME FIX REPORT

## Diagnóstico

### Causa raíz (3 problemas)
1. **`RadioInterface.setVolume()` vacío** — la llamada JS `Android.setVolume(vol)` se perdía sin llegar a ExoPlayer.
2. **Sin `getVolume()` ni sincronización** — el slider HTML arrancaba en `0.8` pero ExoPlayer arrancaba en `1.0`. No había forma de que JS conociera el volumen real del reproductor.
3. **Volumen no persistente** — al recrearse el Service (destroy/restart), el volumen volvía a `1.0` (default de ExoPlayer) ignorando el valor del slider.

### Archivos tocados

| Archivo | Cambio |
|---|---|
| `AudioService.kt` | `currentVolume` persistente; `volume = currentVolume` en `onCreate`; `getVolume()` agregado |
| `RadioInterface.kt` | `setVolume()` → llama a `AudioService.instance?.setVolume()`; nuevo `getVolume(): Double` |
| `script.js` | `syncVolume()` llama a `Android.getVolume()` al cargar y tras play; slider envía `Android.setVolume(vol)` |

## Flujo final

```
HTML slider drag
  → JS input event: audio.volume = vol; Android.setVolume(vol)
    → RadioInterface.setVolume(Double)
      → AudioService.instance?.setVolume(vol.toFloat())
        → currentVolume = vol.coerceIn(0f,1f)
        → mainHandler.post { exoPlayer?.volume = currentVolume }
```

### Sincronización bidireccional
```
App inicia / Play presionado
  → JS: if (isAndroid()) syncVolume()
    → Android.getVolume(): Double
      → AudioService.getVolume(): Float
        → JS: slider.value = vol, audio.volume = vol
```

## Verificación

- Compilación: `BUILD SUCCESSFUL`
- Volumen persiste entre ciclos de vida del Service
- Slider refleja el volumen real de ExoPlayer al cargar y al presionar Play
- Slider controla ExoPlayer en tiempo real (por `mainHandler.post`)
