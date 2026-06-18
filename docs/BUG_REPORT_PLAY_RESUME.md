# BUG REPORT — Play no funciona después de Pause desde notificación

**Fecha:** 5 de junio de 2026  
**Componente:** `AudioService.kt`  
**Severidad:** CRÍTICO — reproduce en producción  

---

## Síntoma

1. Radio reproduce correctamente al presionar Play desde la UI web.
2. Notificación multimedia aparece con metadata correcta.
3. Al presionar PAUSE en la notificación → el audio se detiene, el icono cambia a PLAY.
4. Al presionar PLAY en la notificación → **no se reanuda la reproducción**.
5. El bug no ocurre si se presiona Play desde la UI web (solo desde la notificación).

---

## Causa raíz

### Línea afectada: `AudioService.kt:172` (antes de la corrección)

El `PendingIntent` del botón PLAY en la notificación se construía **sin incluir `EXTRA_URL`**:

```kotlin
// ANTES — NO incluía streamUrl
val playIntent = PendingIntent.getService(
    this, 1,
    Intent(this, AudioService::class.java).apply { action = ACTION_PLAY },
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
)
```

### Cadena de fallo

```
Notificación → PendingIntent(ACTION_PLAY) → onStartCommand()
  → ACTION_PLAY branch
  → intent.getStringExtra(EXTRA_URL) → null
  → Elvis operator: null ?: return START_STICKY    ← AQUÍ FALLA
  → onStartCommand retorna sin llamar a prepare()/play()
  → ExoPlayer sigue en estado PAUSED
  → El usuario no escucha audio
```

`AudioService.kt:50`:
```kotlin
streamUrl = intent.getStringExtra(EXTRA_URL) ?: return START_STICKY
```

El Elvis operator `?: return START_STICKY` fue diseñado como guardia para cuando el Intent no tiene URL, pero el `PendingIntent` de la notificación **nunca la incluía**, por lo que el guardia siempre se activaba al reanudar desde la notificación.

### Contraste con el flujo correcto (UI web)

```kotlin
// RadioInterface.kt:8-17 — SIEMPRE incluye URL
fun play(url: String, title: String, artist: String) {
    val intent = Intent(context, AudioService::class.java).apply {
        action = AudioService.ACTION_PLAY
        putExtra(AudioService.EXTRA_URL, url)          // ← presente
        putExtra(AudioService.EXTRA_TITLE, title)      // ← presente
        putExtra(AudioService.EXTRA_ARTIST, artist)    // ← presente
    }
    startServiceSafely(intent)
}
```

Por eso el bug **solo** ocurría desde la notificación y no desde la UI web.

---

## Corrección aplicada

### Archivo: `AudioService.kt:172-177`

Se agregaron los tres extras faltantes al `Intent` del `PendingIntent` PLAY:

```kotlin
// DESPUÉS — incluye streamUrl + metadata
val playIntent = PendingIntent.getService(
    this, 1,
    Intent(this, AudioService::class.java).apply {
        action = ACTION_PLAY
        putExtra(EXTRA_URL, streamUrl)
        putExtra(EXTRA_TITLE, currentTitle)
        putExtra(EXTRA_ARTIST, currentArtist)
    },
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
)
```

Las variables `streamUrl`, `currentTitle` y `currentArtist` se mantienen actualizadas en memoria durante todo el ciclo de vida del `AudioService` (se setean en `onStartCommand` para cada acción).

---

## Verificación

| Escenario | Antes | Después |
|-----------|-------|---------|
| Play desde UI web → Pause desde notif. → Play desde notif. | ❌ No reanuda | ✅ Reanuda |
| Play desde UI web → Pause desde notif. → Play desde UI web | ✅ Funciona | ✅ Funciona |
| Play desde notif. (app recién abierta) | ❌ No inicia | ✅ Inicia |
| Pantalla bloqueada → Pause → Play | ❌ No reanuda | ✅ Reanuda |
| Metadata actualizada después de reanudar | N/A | ✅ Notificación se actualiza |

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `android_app/app/src/main/java/.../AudioService.kt` | Líneas 172-177: agregados `EXTRA_URL`, `EXTRA_TITLE`, `EXTRA_ARTIST` al Intent del botón PLAY en la notificación |

**Líneas exactas modificadas:** 170-179 (bloque `playIntent`).

---

## Resumen

| Métrica | Valor |
|---------|-------|
| Bug | Play desde notificación no reanuda reproducción |
| Causa | `PendingIntent` de PLAY sin `EXTRA_URL` → Elvis operator aborta en línea 50 |
| Fix | Agregar `putExtra(EXTRA_URL, streamUrl)` (y metadata) al Intent del botón PLAY |
| Riesgo de regresión | Ninguno — solo se agregaron extras a un Intent existente |
