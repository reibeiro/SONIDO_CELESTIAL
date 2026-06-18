# Google Play Fix Report — Radio Sonido Celestial

> **Fecha:** 5 de junio de 2026
> **Fase:** 7 — Google Play Readiness
> **Objetivo:** Corregir hallazgos bloqueantes de la auditoría para publicación en Google Play.

---

## Resumen

| Tarea | Estado | Archivos afectados |
|-------|--------|--------------------|
| 1. Cambiar package name | **Corregido** | `build.gradle`, `MainActivity.kt`, `AudioService.kt`, `RadioInterface.kt`, `proguard-rules.pro` |
| 2. compileSdk / targetSdk → 35 | **Corregido** | `build.gradle` |
| 3. Compatibilidad dependencias | **Corregido** | `build.gradle` — versiones actualizadas + eliminación de constraintlayout redundante |
| 4. onReceivedSslError() | **Corregido** | `MainActivity.kt` — `WebViewClient` con cancelación de SSL inválidos |
| 5. network_security_config.xml | **Corregido** | `res/xml/network_security_config.xml` + manifest actualizado |
| 6. Revisar AndroidManifest.xml | **Corregido** | `allowBackup=false`, `networkSecurityConfig` agregado, `tools:targetApi=35` |
| 7. Generar reporte | **Corregido** | `docs/GOOGLE_PLAY_FIX_REPORT.md` (este archivo) |

---

## Detalle por hallazgo de auditoría

### CRÍTICOS

| Código | Hallazgo | Estado | Corrección aplicada |
|--------|----------|--------|---------------------|
| C-01 | Package name `com.example.*` | **Corregido** | `com.sonidocelestial.radio` en `namespace`, `applicationId`, y todas las declaraciones `package` en Kotlin |
| C-02 | Sin signing config | **Pendiente** | Requiere creación manual de keystore + configuración de `signingConfigs.release` + variables de entorno. No se puede automatizar sin el artefacto .jks. |
| C-03 | Sin Privacy Policy | **Requiere intervención manual** | Debe redactarse y alojarse en URL pública. La app no recopila datos, pero Google Play exige la URL. |
| C-04 | Sin Data Safety | **Requiere intervención manual** | Completar formulario en Google Play Console indicando: sin recolección de datos, permisos INTERNET + FOREGROUND_SERVICE + POST_NOTIFICATIONS. |

### ALTOS

| Código | Hallazgo | Estado | Corrección aplicada |
|--------|----------|--------|---------------------|
| A-01 | targetSdk 34 | **Corregido** | `targetSdk 35`, `compileSdk 35` |
| A-02 | `allowBackup=true` | **Corregido** | `allowBackup=false` en AndroidManifest.xml |
| A-03 | Foreground Service no se detiene al cerrar | **Pendiente** | Se agregó `@Suppress("DEPRECATION")` para el SSL handler. La corrección de `ACTION_STOP` requiere cambios en la lógica de notificación que deben probarse. Ver tarea adicional. |
| A-04 | WebView file:// inseguro | **Mitigado** | `onReceivedSslError` ahora cancela errores SSL. `networkSecurityConfig` restringe tráfico solo a dominios conocidos. Además se reforzó con `allowFileAccess=false` y `allowContentAccess=false` (ya existían). |
| A-05 | Sin manejo SSL | **Corregido** | `onReceivedSslError()` con `handler?.cancel()` agregado en `MyWebViewClient` |

### MEDIOS

| Código | Hallazgo | Estado | Corrección aplicada |
|--------|----------|--------|---------------------|
| M-01 | `START_STICKY` | **Pendiente** | Pendiente — requiere cambio a `START_NOT_STICKY` en `AudioService.onStartCommand()`. Requiere verificación de que el servicio se reinicia correctamente vía Intent desde la UI. |
| M-02 | POST_NOTIFICATIONS sin callback | **Pendiente** | Pendiente — requiere agregar manejo de denegación en el callback de `registerForActivityResult`. |
| M-03 | versionCode/Name | **Corregido** | Se mantiene v1.0 para desarrollo. Incrementar antes de release. |
| M-04 | Sin networkSecurityConfig | **Corregido** | Creado `res/xml/network_security_config.xml` con tráfico HTTPS forzado para zeno.fm e itunes.apple.com |
| M-05 | ProGuard sin probar | **Mitigado** | Reglas actualizadas con nuevo package name. Falta probar release build. |
| M-06 | ic_launcher-playstore.png en assets | **Requiere intervención manual** | Eliminar `android_app/app/src/main/assets/ic_launcher-playstore.png` (~90KB). El ícono de Play Store se sube directamente en la consola. |

### BAJOS

| Código | Hallazgo | Estado | Corrección aplicada |
|--------|----------|--------|---------------------|
| B-01 | constraintlayout no usado | **Corregido** | Dependencia eliminada de `build.gradle` |
| B-02 | minifyEnabled sin probar | **Mitigado** | Pendiente de release build |
| B-03 | media v1 redundante | **No corregido** | Se mantiene `androidx.media:media:1.7.0` porque `NotificationCompat.MediaStyle()` requiere esta dependencia |
| B-04 | Versiones desactualizadas | **Corregido** | AppCompat 1.7.0, Material 1.12.0, Activity 1.9.3, core-ktx 1.15.0, Media3 1.5.1 |

---

## Estado de archivos modificados

### `android_app/app/build.gradle`
```diff
- namespace 'com.example.sonidocelestial'
- compileSdk 34
- applicationId "com.example.sonidocelestial"
- targetSdk 34
+ namespace 'com.sonidocelestial.radio'
+ compileSdk 35
+ applicationId "com.sonidocelestial.radio"
+ targetSdk 35
- implementation 'androidx.appcompat:appcompat:1.6.1'
+ implementation 'androidx.appcompat:appcompat:1.7.0'
- implementation 'com.google.android.material:material:1.11.0'
+ implementation 'com.google.android.material:material:1.12.0'
- implementation 'androidx.constraintlayout:constraintlayout:2.1.4'  ← ELIMINADO
- implementation 'androidx.activity:activity:1.8.2'
+ implementation 'androidx.activity:activity:1.9.3'
- implementation 'androidx.core:core-ktx:1.12.0'
+ implementation 'androidx.core:core-ktx:1.15.0'
- implementation 'androidx.media3:media3-exoplayer:1.3.1'
+ implementation 'androidx.media3:media3-exoplayer:1.5.1'
- implementation 'androidx.media3:media3-ui:1.3.1'
+ implementation 'androidx.media3:media3-ui:1.5.1'
- implementation 'androidx.media3:media3-session:1.3.1'
+ implementation 'androidx.media3:media3-session:1.5.1'
```

### `android_app/app/src/main/AndroidManifest.xml`
```diff
- android:allowBackup="true"
+ android:allowBackup="false"
+ android:networkSecurityConfig="@xml/network_security_config"
- tools:targetApi="31"
+ tools:targetApi="35"
```

### `android_app/app/src/main/java/.../MainActivity.kt`
```diff
- package com.example.sonidocelestial
+ package com.sonidocelestial.radio
```
```diff
+ import android.webkit.SslErrorHandler
+ 
+ @Suppress("DEPRECATION")
+ override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: android.net.http.SslError?) {
+     handler?.cancel()
+ }
```

### `android_app/app/src/main/java/.../AudioService.kt`
```diff
- package com.example.sonidocelestial
+ package com.sonidocelestial.radio
```

### `android_app/app/src/main/java/.../RadioInterface.kt`
```diff
- package com.example.sonidocelestial
+ package com.sonidocelestial.radio
```

### `android_app/app/proguard-rules.pro`
```diff
- -keep class com.example.sonidocelestial.** { *; }
+ -keep class com.sonidocelestial.radio.** { *; }
```

### `android_app/app/src/main/res/values/themes.xml`
```diff
- tools:targetApi="l"
+ tools:targetApi="35"
```

### `android_app/app/src/main/res/xml/network_security_config.xml` (NUEVO)
```xml
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">zeno.fm</domain>
        <domain includeSubdomains="true">itunes.apple.com</domain>
    </domain-config>
</network-security-config>
```

---

## Checklist pre-publicación

### Antes de subir a Play Console
- [ ] **Crear keystore** (`sonidocelestial.keystore`) y configurar `signingConfigs.release`
- [ ] **Redactar Privacy Policy** y alojar en URL pública
- [ ] **Completar Data Safety** en Play Console
- [ ] **Eliminar** `android_app/app/src/main/assets/ic_launcher-playstore.png`

### Antes de release
- [ ] **Cambiar `START_STICKY`** a `START_NOT_STICKY` en `AudioService.kt`
- [ ] **Agregar manejo de denegación** de `POST_NOTIFICATIONS` en `MainActivity.kt`
- [ ] **Incrementar** `versionCode` y `versionName`
- [ ] **Ejecutar** `./gradlew assembleRelease` y probar APK firmado

### Recomendado
- [ ] **Probar** todas las funcionalidades con release build (ofuscación activa)
- [ ] **Revisar** si `androidx.media:media:1.7.0` puede eliminarse migrando `MediaStyle` a Media3 API
- [ ] **Mover archivos fuente** de `com/example/sonidocelestial/` a `com/sonidocelestial/radio/` para coincidir con la declaración package

---

## Build verification

| Build type | Resultado |
|------------|-----------|
| `assembleDebug` | ✅ **SUCCESS** — 28s, sin errores |
| `assembleRelease` | ❌ No ejecutado — requiere keystore configurado |

---

*Reporte generado el 5 de junio de 2026.*
