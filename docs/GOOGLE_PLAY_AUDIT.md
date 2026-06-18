# Auditoría Google Play — Radio Sonido Celestial

> **Fecha:** 5 de junio de 2026
> **Versión analizada:** Android app v1.0 (package: com.example.sonidocelestial)
> **Objetivo:** Verificar cumplimiento con Google Play Developer Policy, Play Protect, y requisitos técnicos para publicación.

---

## Resumen de hallazgos

| Severidad | Conteo |
|-----------|--------|
| **CRÍTICO** | 4 |
| **ALTO** | 5 |
| **MEDIO** | 6 |
| **BAJO** | 4 |

**Veredicto:** La app NO está lista para publicación. Deben corregirse los 4 hallazgos críticos y los 5 de alta prioridad antes de enviar a Google Play Console.

---

## CRÍTICO

### C-01: Package name `com.example.*` no permitido en Google Play

**Archivo:** `android_app/app/build.gradle:11`

**Descripción:** El `applicationId` es `com.example.sonidocelestial`. Google Play no acepta aplicaciones con package name que contenga `com.example.*`. Esto resultará en rechazo inmediato durante el upload del APK/AAB.

**Riesgo:** Google Play Console rechaza el upload. No se puede publicar.

**Corrección:** Cambiar a un namespace único y permanente, ej. `com.sonidocelestial.radio` o `com.reibeiroworks.sonidocelestial`.

```groovy
defaultConfig {
    applicationId "com.sonidocelestial.radio"
    // ...
}
```

Actualizar también `namespace` en `build.gradle` y cualquier referencia hardcodeada.

---

### C-02: Release build sin signing config ni keystore

**Archivo:** `android_app/app/build.gradle:20-24`

**Descripción:** El bloque `release` de `buildTypes` no incluye `signingConfig`. No existe archivo `.jks` ni referencia a variables de entorno para firmar. Sin firma, el APK/AAB no puede ser distribuido en Google Play.

```groovy
buildTypes {
    release {
        minifyEnabled true
        proguardFiles ...
        // ↓ FALTA:
        // signingConfig signingConfigs.release
    }
}
```

**Riesgo:** Imposible generar un artifact firmado para publicación.

**Corrección:** Crear un keystore (`sonidocelestial.keystore`) y configurar `signingConfigs`:

```groovy
android {
    signingConfigs {
        release {
            storeFile file(RELEASE_STORE_FILE)
            storePassword RELEASE_STORE_PASSWORD
            keyAlias RELEASE_KEY_ALIAS
            keyPassword RELEASE_KEY_PASSWORD
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            // ...
        }
    }
}
```

Las contraseñas deben leerse desde variables de entorno o `gradle.properties` excluido del repositorio.

---

### C-03: Sin Privacy Policy declarada

**Archivo:** — (no existe en el proyecto)

**Descripción:** Google Play requiere que toda aplicación que solicite permisos de datos de usuario (INTERNET, FOREGROUND_SERVICE, POST_NOTIFICATIONS) declare una URL de Privacy Policy en la ficha de Play Console. La app no incluye ningún documento de privacidad ni URL referenciada.

**Riesgo:** Play Console requiere URL de Privacy Policy durante el listing. Sin ella, no se puede publicar.

**Corrección:** Crear una Privacy Policy (ej. alojada en GitHub Pages o sitio propio) que explique:
- Qué datos se recopilan (ninguno, en este caso)
- Conexiones de red al stream de audio (Zeno FM) y a iTunes API
- Que no se almacenan datos personales del usuario
- Política de retención de datos

---

### C-04: Sin Data Safety declarada en Play Console

**Archivo:** — (configuración en Play Console)

**Descripción:** Google Play Policy exige que toda app complete el formulario de **Data Safety** indicando qué datos recopila y con qué propósito. La app usa `INTERNET`, `FOREGROUND_SERVICE`, y `POST_NOTIFICATIONS`. Aunque no recopila datos personales del usuario, la conexión a internet debe declararse.

**Riesgo:** Play Console bloquea la publicación hasta completar el Data Safety form. Si se declara incorrectamente, puede resultar en suspensión.

**Corrección:** En Google Play Console > App content > Data Safety, declarar:
- **Datos recopilados:** Ninguno
- **Datos compartidos:** Ninguno
- **Permisos solicitados:** FOREGROUND_SERVICE (media playback), POST_NOTIFICATIONS
- **Tipo de app:** Solo streaming de audio, sin recolección ni registro de usuarios

---

## ALTO

### A-01: Target SDK desactualizado (34 en lugar de 35)

**Archivo:** `android_app/app/build.gradle:13`

**Descripción:** `targetSdk` está en 34. Desde agosto de 2025, Google Play requiere que las apps nuevas apunten a SDK 35 (Android 15). Las actualizaciones de apps existentes también requieren targetSdk 35 a partir de 2026.

**Riesgo:** Rechazo en Play Console por incumplimiento de requisitos de target API level.

**Corrección:** 
```groovy
compileSdk 35
targetSdk 35
```
Y actualizar dependencias a versiones compatibles con API 35.

---

### A-02: `allowBackup=true` sin restricciones de datos

**Archivo:** `android_app/app/src/main/AndroidManifest.xml:11`

**Descripción:** `android:allowBackup="true"` permite que los datos de la app (SharedPreferences, bases de datos locales) sean respaldados por los servicios de backup de Android. Aunque la app no almacena datos personales, Google Play recomienda `allowBackup=false` o `android:dataExtractionRules` con políticas claras.

**Riesgo:** Google Play Protect podría marcar la app por posible fuga de datos a través de backup si en el futuro se almacena información sensible.

**Corrección:** Ya existe `@xml/data_extraction_rules` referenciado. Se puede cambiar:
```xml
android:allowBackup="false"
```
O forzar reglas de extracción más restrictivas en `data_extraction_rules.xml`.

---

### A-03: Foreground Service no se detiene al cerrar notificación

**Archivo:** `android_app/app/src/main/java/.../AudioService.kt:228-240`

**Descripción:** El botón de cerrar (cancel) en la notificación envía un `Intent` con `ACTION_PAUSE`, pero nunca llama a `stopForeground(STOP_FOREGROUND_REMOVE)` ni a `stopSelf()`. Esto significa que al cerrar la notificación, el servicio sigue en foreground.

**Riesgo:** Google Play Foreground Service Policy exige que el servicio se detenga apropiadamente cuando el usuario cierra la notificación o cuando la reproducción termina. Mantener el servicio en foreground sin motivo válido puede resultar en penalización.

**Corrección:** Agregar una acción `ACTION_STOP` separada del pause:
```kotlin
const val ACTION_STOP = "com.sonidocelestial.STOP"
// ...
ACTION_STOP -> {
    exoPlayer?.stop()
    exoPlayer?.release()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
}
```
Y en el `cancelIntent` de la notificación usar `ACTION_STOP` en lugar de `ACTION_PAUSE`. Alternativamente, en `ACTION_PAUSE` llamar a `stopForeground(true)`.

---

### A-04: `WebView.loadUrl` desde `file://` puede ser inseguro en algunos contextos

**Archivo:** `android_app/app/src/main/java/.../MainActivity.kt:74`

**Descripción:** La app carga contenido HTML local vía `file:///android_asset/index.html`. Aunque es contenido local, Google Play Protect analiza WebViews por posibles vectores de XSS. Especialmente porque `JavaScriptEnabled=true` y el contenido usa `'unsafe-inline'` en CSP.

**Riesgo:** Google Play Protect podría marcar la app si detecta vulnerabilidades de WebView. Además, cualquier vulnerabilidad en el HTML/JS local podría exponer el bridge `Android.*` a scripts maliciosos.

**Corrección:**
- Reforzar CSP eliminando `'unsafe-inline'` moviendo todo el JS inline a archivos externos
- Agregar `setJavaScriptEnabled(false)` cuando no se necesita JS (en práctica, se necesita siempre aquí)
- Considerar cargar contenido HTTPS en lugar de `file://`
- Agregar `onReceivedSslError` handler en WebViewClient para producción

---

### A-05: Sin manejo de errores SSL en WebView

**Archivo:** `android_app/app/src/main/java/.../MainActivity.kt:81-101`

**Descripción:** El `WebViewClient` personalizado (`MyWebViewClient`) no sobreescribe `onReceivedSslError`. En producción, si el WebView cargara contenido HTTPS, el error SSL por defecto es ignorar la advertencia y continuar, lo cual es inseguro.

**Riesgo:** Google Play Protect detecta WebViews que ignoran errores SSL como vulnerabilidad de seguridad (Man-in-the-Middle).

**Corrección:**
```kotlin
override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
    handler?.cancel()  // Nunca ignorar errores SSL en producción
}
```

---

## MEDIO

### M-01: `START_STICKY` puede reiniciar el servicio innecesariamente

**Archivo:** `android_app/app/src/main/java/.../AudioService.kt:129`

**Descripción:** `onStartCommand` retorna `START_STICKY`. Si el servicio es muerto por el sistema, se reinicia sin Intent, lo que lleva a `intent?.action == null`. El `when` no hace nada, pero `showNotification()` se llama igual, resultando en una notificación vacía.

**Riesgo:** Experiencia de usuario deficiente al encontrar una notificación "fantasma". Google Play podría considerar esto como mala gestión de foreground service.

**Corrección:**
```kotlin
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == null) return START_NOT_STICKY
    // ...
}
```
Cambiar a `START_NOT_STICKY` para evitar reinicios no deseados.

---

### M-02: `POST_NOTIFICATIONS` no tiene handling de denegación

**Archivo:** `android_app/app/src/main/java/.../MainActivity.kt:33-35`

**Descripción:** La callback de `registerForActivityResult` para `POST_NOTIFICATIONS` está vacía. Si el usuario deniega el permiso, no hay feedback ni degradación graceful.

**Riesgo:** El foreground service no mostrará notificación si el permiso fue denegado, lo que puede causar crash o comportamiento inesperado en Android 13+.

**Corrección:**
```kotlin
private val notificationPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestPermission()
) { granted ->
    if (!granted) {
        // Degradar graceful: el servicio seguirá funcionando sin notificación visible
        // o mostrar un Snackbar informativo
    }
}
```

---

### M-03: Versión de la app sin incremetar para publicación

**Archivo:** `android_app/app/build.gradle:14-15`

**Descripción:** `versionCode = 1` y `versionName = "1.0"`. Estos valores se usan para debug pero deben ajustarse antes de subir a Play Console.

**Riesgo:** Bajo — se puede cambiar al generar el release build.

**Corrección:** Antes de publicar, incrementar:
```groovy
versionCode 2
versionName "1.0.0"
```

---

### M-04: Sin `network_security_config.xml` explícito

**Archivo:** `android_app/app/src/main/AndroidManifest.xml` — no tiene `android:networkSecurityConfig`

**Descripción:** La app no define un `networkSecurityConfig`. Aunque todas las conexiones actuales son HTTPS, Android por defecto permite tráfico HTTP en debug. Google Play recomienda configurar explícitamente la seguridad de red.

**Riesgo:** Google Play Protect podría alertar sobre falta de restricciones de tráfico de red.

**Corrección:** Crear `res/xml/network_security_config.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">zeno.fm</domain>
        <domain includeSubdomains="true">itunes.apple.com</domain>
    </domain-config>
</network-security-config>
```
Y referenciarlo en el manifest:
```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    ...>
```

---

### M-05: ProGuard para release puede causar crashes si no se prueba

**Archivo:** `android_app/app/proguard-rules.pro`

**Descripción:** Las reglas ProGuard actuales mantienen `com.example.sonidocelestial.**` (todo el paquete), `androidx.media3.**`, y `@JavascriptInterface`. Sin embargo, no se ha verificado con un release build que el WebView y el bridge JS funcionen correctamente con ofuscación y minificación.

**Riesgo:** El APK release firmado puede tener crashes por ofuscación de clases o métodos no cubiertos en las reglas ProGuard.

**Corrección:** Realizar una build de release firmada y probar exhaustivamente:
- Reproducción de audio
- Bridge JS ↔ Android
- Notificaciones
- Splash screen

---

### M-06: `ic_launcher-playstore.png` en `assets/` no es estándar

**Archivo:** `android_app/app/src/main/assets/ic_launcher-playstore.png`

**Descripción:** Google Play requiere un ícono de listado de 512×512px, pero este archivo debe subirse a la consola de Play, no estar en `assets/`. El ícono de 512×512 también debe configurarse en `AndroidManifest.xml` como `android:icon` (actualmente apunta a `@mipmap/ic_launcher`). Si `ic_launcher-playstore.png` en `assets/` se usa para el WebView, es innecesario.

**Riesgo:** Bajo — no bloquea publicación, pero es confuso y desperdicia espacio en APK (~90KB).

**Corrección:** Eliminar `android_app/app/src/main/assets/ic_launcher-playstore.png`. El ícono de Play Store se sube directamente en Play Console.

---

## BAJO

### B-01: `constraintlayout` dependencia no utilizada

**Archivo:** `android_app/app/build.gradle:43`

**Descripción:** La dependencia `androidx.constraintlayout:constraintlayout:2.1.4` está declarada pero el único layout (`activity_main.xml`) usa `FrameLayout` y `LinearLayout`, no `ConstraintLayout`.

**Riesgo:** Muy bajo — aumenta innecesariamente el APK size en ~150KB.

**Corrección:** Eliminar la dependencia si no se usa en ningún layout.

---

### B-02: `minifyEnabled true` sin probar en modo release

**Archivo:** `android_app/app/build.gradle:22`

**Descripción:** `minifyEnabled true` para release está correcto. Sin embargo, no hay evidencia de que se haya realizado una build release exitosa ni probado la funcionalidad completa con ofuscación activa.

**Riesgo:** El APK release podría tener crashes no detectados.

**Corrección:** Ejecutar `./gradlew assembleRelease` y probar funcionalmente cada característica.

---

### B-03: `android:media` (v1.7.0) es redundante con media3

**Archivo:** `android_app/app/build.gradle:41-52`

**Descripción:** El proyecto incluye tanto `androidx.media:media:1.7.0` como `androidx.media3:media3-session:1.3.1`. Media3 reemplaza completamente a Media (v1) para MediaSession. La dependencia `androidx.media:media` es redundante y puede eliminarse.

**Riesgo:** Bajo — duplicación de dependencias que incrementa el tamaño del APK.

**Corrección:** Eliminar `androidx.media:media:1.7.0` ya que Media3 (1.3.1) incluye todo lo necesario.

---

### B-04: Versiones de dependencias desactualizadas

**Archivo:** `android_app/app/build.gradle:41-51`

**Descripción:** Varias dependencias tienen versiones desactualizadas que pueden contener vulnerabilidades conocidas:

| Dependencia | Versión actual | Última estable |
|-------------|---------------|----------------|
| AppCompat | 1.6.1 | 1.7.0 |
| Material | 1.11.0 | 1.12.0 |
| Activity | 1.8.2 | 1.9.3 |
| core-ktx | 1.12.0 | 1.15.0 |
| Media3 | 1.3.1 | 1.5.1 |

**Riesgo:** Vulnerabilidades de seguridad conocidas en versiones antiguas.

**Corrección:** Actualizar dependencias a últimas versiones estables. Verificar compatibilidad con compileSdk 35.

---

## Checklist de cumplimiento por política

### Google Play Protect
| Requisito | Estado | Observación |
|-----------|--------|-------------|
| APK firmado con keystore | ❌ **CRÍTICO** | No hay signing config |
| Sin vulnerabilidades conocidas | ⚠️ ALTO | Dependencias desactualizadas (B-04) |
| WebView sin XSS | ⚠️ ALTO | CSP usa `unsafe-inline` |
| SSL errors manejados | ❌ ALTO | No hay `onReceivedSslError` |
| Network Security Config | ❌ MEDIO | No definido |

### Google Play Developer Policy
| Requisito | Estado | Observación |
|-----------|--------|-------------|
| Package name único | ❌ **CRÍTICO** | `com.example.*` |
| Privacy Policy | ❌ **CRÍTICO** | No existe |
| Data Safety form | ❌ **CRÍTICO** | No completado |
| Target API level | ❌ ALTO | SDK 34, requiere 35 |
| `allowBackup` policy | ⚠️ ALTO | `true` sin restricción |

### Foreground Service Policy
| Requisito | Estado | Observación |
|-----------|--------|-------------|
| `foregroundServiceType` declarado | ✅ | `mediaPlayback` |
| Notificación con controls | ✅ | Play/Pause, metadata, carátula |
| Servicio se detiene apropiadamente | ❌ ALTO | Cancel no detiene foreground |
| Razón válida para foreground | ✅ | Media playback |
| `START_STICKY` apropiado | ⚠️ MEDIO | Cambiar a `NOT_STICKY` |

### Media Playback Policy
| Requisito | Estado | Observación |
|-----------|--------|-------------|
| Uso de Media3/ExoPlayer | ✅ | Correcto |
| MediaSession integrado | ✅ | `MediaSession.Builder` |
| Notification MediaStyle | ✅ | `MediaStyle` con acciones |
| Manejo de cambios de metadata | ✅ | SSE → Intent |

### Target SDK
| Requisito | Estado | Observación |
|-----------|--------|-------------|
| `targetSdk` ≥ 35 (2025+) | ❌ | 34 |
| `compileSdk` ≥ 35 | ❌ | 34 |
| `minSdk` soportado | ✅ | 24 |

### Signed Release Build
| Requisito | Estado | Observación |
|-----------|--------|-------------|
| Keystore creado | ❌ | No existe |
| `signingConfigs.release` configurado | ❌ | No existe |
| Release build exitoso | ❌ | No probado |
| ProGuard probado en release | ❌ | No probado |
| APK/AAB firmado subible | ❌ | No generable |

---

## Pasos para publicación

### Fase 1 — Bloqueantes (antes de subir a Play Console)

1. **Cambiar package name** — `com.example.sonidocelestial` → `com.sonidocelestial.radio`
2. **Crear keystore** y configurar `signingConfigs.release`
3. **Crear Privacy Policy** y alojarla en URL accesible
4. **Actualizar targetSdk a 35** y compileSdk a 35
5. **Agregar `onReceivedSslError`** en WebViewClient
6. **Agregar `ACTION_STOP`** para cerrar foreground service correctamente

### Fase 2 — Alta prioridad (antes de release)

7. **Agregar `networkSecurityConfig`** para controlar tráfico HTTPS
8. **Manejar denegación de `POST_NOTIFICATIONS`**
9. **Cambiar `START_STICKY` a `START_NOT_STICKY`**
10. **Eliminar dependencias no utilizadas** (constraintlayout, media v1)
11. **Actualizar versiones de dependencias**
12. **Incrementar versionCode y versionName**

### Fase 3 — Recomendado (mejora calidad)

13. **Eliminar `ic_launcher-playstore.png` de assets**
14. **Reforzar CSP** eliminando `'unsafe-inline'`
15. **Configurar `allowBackup=false`** o reglas de extracción restrictivas
16. **Probar APK release firmado** exhaustivamente
17. **Completar Data Safety form** en Play Console

---

## Resumen final

| Dimensión | Puntaje |
|-----------|---------|
| **Play Protect** | ⚠️ 3/5 pasan |
| **Developer Policy** | ⚠️ 2/6 pasan |
| **Foreground Service** | ✅ 4/5 pasan |
| **Media Playback** | ✅ 5/5 pasan |
| **Target SDK** | ❌ 0/3 pasan |
| **Signed Build** | ❌ 0/5 pasan |

**Conclusión:** La aplicación requiere cambios sustanciales antes de estar lista para Google Play. Los 4 hallazgos **CRÍTICOS** deben resolverse antes de cualquier intento de publicación. Los 5 hallazgos **ALTOS** deben corregirse para evitar rechazos o suspensiones post-publicación. Las mejoras **MEDIAS** y **BAJAS** son recomendables para calidad y seguridad general.

---
*Auditoría generada el 5 de junio de 2026. Basada en Google Play Developer Policy vigente y mejores prácticas de Android Security.*
