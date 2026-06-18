# Play Store Final Report — Radio Sonido Celestial

> **Fecha:** 5 de junio de 2026
> **Fase:** 7.1 — Publication Blockers
> **Estado final:** ✅ Listo para publicación (pendientes manuales)

---

## Resumen de correcciones

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| 1 | `START_STICKY` → `START_NOT_STICKY` | **Corregido** | `AudioService.kt` |
| 2 | `ACTION_STOP` implementado | **Corregido** | `AudioService.kt` |
| 3 | Detener ExoPlayer + MediaSession + Foreground | **Corregido** | `AudioService.kt` — `stopPlayback()` + `ACTION_STOP` |
| 4 | Manejar denegación POST_NOTIFICATIONS | **Corregido** | `MainActivity.kt` — persiste denegación en SharedPreferences |
| 5 | Eliminar ic_launcher-playstore.png de assets | **Corregido** | Ya no existe en `assets/` |
| 6 | Build verification | **Corregido** | `assembleDebug` → ✅ SUCCESS (6s) |

---

## Detalle de cambios

### 1. AudioService.kt — `START_STICKY` → `START_NOT_STICKY`

```diff
- return START_STICKY
+ return START_NOT_STICKY
```

Además se agregó guarda al inicio:
```kotlin
if (intent?.action == null) return START_NOT_STICKY
```

Esto evita que el servicio se reinicie sin Intent si es muerto por el sistema, cumpliendo con Google Play Foreground Service Policy.

### 2. AudioService.kt — `ACTION_STOP`

Nueva constante:
```kotlin
const val ACTION_STOP = "com.sonidocelestial.radio.STOP"
```

Nuevo case en `onStartCommand`:
```kotlin
ACTION_STOP -> {
    exoPlayer?.stop()
    exoPlayer?.clearMediaItems()
    mediaSession?.release()
    mediaSession = null
    currentAlbumArtBitmap = null
    stopForeground(true)
    stopSelf()
    return START_NOT_STICKY
}
```

Nuevo método público:
```kotlin
fun stopPlayback() {
    val intent = Intent(this, AudioService::class.java).apply {
        action = ACTION_STOP
    }
    startServiceIfNeeded(intent)
}
```

### 3. Notificación — Cancel button usa `ACTION_STOP`

El botón de cerrar en la notificación ahora envía `ACTION_STOP` en lugar de `ACTION_PAUSE`, asegurando que:
- ExoPlayer se detiene y limpia
- MediaSession se libera
- Foreground notification se remueve
- `stopSelf()` termina el servicio

### 4. MainActivity.kt — Denegación de POST_NOTIFICATIONS

```kotlin
private val notificationPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestPermission()
) { granted ->
    if (!granted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        getSharedPreferences("radio_prefs", MODE_PRIVATE).edit()
            .putBoolean("notification_permission_denied", true)
            .apply()
    }
}
```

Si el usuario deniega, se persiste la preferencia para no volver a solicitar. El servicio funciona sin notificación (Android la suprime automáticamente).

---

## Build verification

| Comando | Resultado | Tiempo |
|---------|-----------|--------|
| `./gradlew assembleDebug` | ✅ **SUCCESS** | 6s |
| Warnings | 2 (deprecados: `stopForeground(boolean)`, `allowFileAccessFromFileURLs`) | — |
| Errores | 0 | — |

Warnings controlados:
- `stopForeground(Boolean)` — deprecado en API R+, se usa `@Suppress("DEPRECATION")` por compatibilidad con minSdk 24
- `allowFileAccessFromFileURLs` — deprecado en API 30+, se mantiene por compatibilidad

---

## Checklist final pre-publicación

### ✅ Completado (no requiere acción)

- [x] Package name cambiado a `com.sonidocelestial.radio`
- [x] compileSdk 35, targetSdk 35
- [x] network_security_config.xml creado
- [x] `onReceivedSslError()` implementado (`handler?.cancel()`)
- [x] `allowBackup=false`
- [x] `tools:targetApi="35"`
- [x] Dependencias actualizadas (AppCompat 1.7, Material 1.12, Media3 1.5.1, etc.)
- [x] `START_NOT_STICKY` configurado
- [x] `ACTION_STOP` implementado con limpieza completa
- [x] Cancel button en notificación → `ACTION_STOP`
- [x] Denegación de POST_NOTIFICATIONS manejada
- [x] constraintlayout eliminado (no usado)

### 🔧 Pendiente manual (fuera del código)

- [ ] **Crear keystore** (`sonidocelestial.keystore`) y configurar `signingConfigs.release`
- [ ] **Redactar Privacy Policy** y alojar en URL pública
- [ ] **Completar Data Safety** en Google Play Console (sin datos recopilados, permisos: INTERNET, FOREGROUND_SERVICE, POST_NOTIFICATIONS)
- [ ] **Subir icono 512×512px** directamente en Play Console
- [ ] **Incrementar** `versionCode` (→2) y `versionName` (→"1.0.0") antes del release build
- [ ] **Ejecutar** `./gradlew assembleRelease` con keystore configurado
- [ ] **Probar APK release firmado** en dispositivo físico (especialmente: reproducción, bridge JS, notificaciones, splash)

---

## Resumen de severidad — Estado final

| Severidad | Auditoría inicial | Después de Fase 7 |
|-----------|-------------------|-------------------|
| **CRÍTICO** | 4 | 0 |
| **ALTO** | 5 | 0 |
| **MEDIO** | 6 | 0 |
| **BAJO** | 4 | 0 |
| **Pendiente manual** | — | 7 (keystore, privacy, data safety, icono, version, release build, testing) |

---

## Veredicto final

**La aplicación está lista para publicación desde el punto de vista técnico.** Todos los bloqueantes de código han sido resueltos:
- ✅ Package name único
- ✅ Target SDK 35
- ✅ SSL errors manejados
- ✅ Network security configurado
- ✅ Foreground service policy cumplida (STOP + limpieza)
- ✅ Backup deshabilitado
- ✅ Permisos runtime correctamente manejados
- ✅ Dependencias actualizadas

Solo restan **7 pasos administrativos/manuales** (keystore, Privacy Policy, Data Safety, etc.) que deben realizarse en Google Play Console y en el entorno de desarrollo local.

---
*Reporte generado el 5 de junio de 2026. Build: `assembleDebug` ✅*
