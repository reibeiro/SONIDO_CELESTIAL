# Auditoría - Mejoras Largo Plazo (3+ meses)

> **Proyecto:** Sonido Celestial
> **Fecha:** 17 de junio de 2026
> **Objetivo:** Planificar la implementación de metadatos SSE nativos en AudioService y la migración del frontend a React + Tailwind CSS.

---

## 1. Diagnóstico del Estado Actual

### Arquitectura General
- **Híbrido**: WebView (UI) + ExoPlayer nativo (audio) con puente `@JavascriptInterface` (`Android.*`).
- **Metadatos SSE**: Consumidos exclusivamente en `script.js:159-181` vía `EventSource` sobre el WebView. **Se detienen cuando el WebView se pausa en segundo plano**, dejando la notificación sin actualizar.
- **Álbum art**: Buscado desde **dos lugares** — JS (`fetchAlbumArt` en `script.js:36-96`) y Kotlin (`fetchAlbumArt` en `AudioService.kt:362-389`) — generando latencia y duplicación.
- **AudioService**: Usa `CoroutineScope(Dispatchers.IO + SupervisorJob)` para descargas de carátulas. No tiene conexión SSE propia.
- **RadioInterface.kt**: Puente unidireccional JS→Kotlin. No existe canal inverso (Kotlin→JS).

### Archivos Relevantes
| Archivo | Líneas | Rol |
|---|---|---|
| `AudioService.kt` | 390 | Foreground service + ExoPlayer + MediaSession |
| `MainActivity.kt` | 148 | WebView + SplashScreen |
| `RadioInterface.kt` | 63 | Puente JS↔Kotlin |
| `script.js` | 549 | Toda la lógica del reproductor web |
| `index.html` | 144 | Estructura HTML |
| `style.css` | 875 | Estilos + animaciones |
| `build.gradle` | 52 | Dependencias (ya incluye corrutinas 1.7.3) |

### Problemas Conocidos (Largo Plazo)
1. **Metadatos dependientes del WebView**: Al minimizar la app, el WebView se congela → la notificación muestra metadata obsoleta.
2. **Doble fetch de álbum art**: JS y Kotlin consultan iTunes API por separado, duplicando requests y retrasando la actualización nativa.
3. **Sin canal inverso nativo**: AudioService no puede notificar al WebView (ej: estado de reproducción, metadata nativa).
4. **Frontend monolítico JS**: 549 líneas en un solo archivo, sin componentes, sin tipado, difícil de mantener y escalar.

### Intentos Previos Fallidos
- **Asignación temprana de callback**: `AudioService.instance` era `null` cuando JS intentaba asignar `window._onNativeMetadata`.
- **`readLine()` bloqueante**: En el polling SSE nativo, `bufferedReader().readLine()` colgaba el servicio al cerrar sin una señal de cancelación limpia.
- **Falta de reconexión**: El polling nativo no tenía backoff ni jitter.

---

## 2. Arquitectura Objetivo — Metadatos SSE nativos en AudioService

### Principios de Diseño
- **Resiliencia**: Reconexión con backoff exponencial + jitter (misma estrategia que `script.js:174-180` pero del lado nativo).
- **No bloqueante**: Usar `kotlinx.coroutines` con `flow` en lugar de `readLine()` síncrono.
- **Ciclo de vida correcto**: Iniciar/parar el polling SSE en `onStartCommand`/`onDestroy`. Asignar `instance` en `onCreate` **antes** de que cualquier callback externo pueda ejecutarse.
- **Canal inverso seguro**: Usar `Handler(Looper.getMainLooper()).post { mainWebView?.evaluateJavascript(...) }` desde AudioService, con `?.` para evitar NPE si el WebView no está listo.

### Diagrama de Flujo Propuesto

```
AudioService.onCreate()
  └─ instance = this
  └─ initExoPlayer()
  └─ startNativeMetadataPolling()  ← NUEVO

startNativeMetadataPolling()
  └─ launch coroutine SSE flow
       ├─ connect → read lines → parse JSON
       ├─ extraer artist/title
       ├─ fetchAlbumArt()  ← unificado (solo nativo)
       ├─ updateNotification()
       └─ evaluateJavascript("_onNativeMetadata({...})")
  └─ on error → retry con delay exponencial + jitter

RadioInterface.updateMetadata()
  └─ Se mantiene como respaldo para cuando WebView está activo
     Pero AudioService IGNORA duplicados (dedup por streamTitle)
```

### Requisitos Técnicos
| Item | Detalle |
|---|---|
| HTTP SSE | `HttpURLConnection` + `BufferedReader` dentro de corrutina, o migrar a `OkHttp` |
| Parse SSE | Separar líneas `data: ...` manualmente (event-stream simple de Zeno) |
| Reconexión | Backoff: 5s → 10s → 20s → ... → 60s máx, con jitter aleatorio ±3s |
| Dedup | Comparar `streamTitle` actual vs anterior antes de actualizar |
| Cancelación | `job.cancel()` en `onDestroy` + `isActive` check en el loop SSE |
| Canal inverso | `(activity as? MainActivity)?.runOnUiThread { webView.evaluateJs(...) }` |

### Código Mínimo a Modificar
- **AudioService.kt**: Añadir `startNativeMetadataPolling()`, `parseSseLine()`, campo `metadataJob: Job?`, lógica de reconexión.
- **MainActivity.kt**: Exponer método `evaluateInWebView(js: String)` para que AudioService pueda llamarlo.
- **RadioInterface.kt**: Sin cambios (el puente JS→Kotlin se mantiene igual).
- **script.js**: Añadir listener global `window._onNativeMetadata = (data) => { ... }` para el canal inverso. Mantener el SSE JS como **fallback** cuando no hay servicio nativo.

---

## 3. Estrategia de Migración a React + Tailwind CSS

### Enfoque Gradual (no reescritura total)
El frontend actual (index.html + style.css + script.js, ~1568 líneas) no puede reescribirse de golpe sin detener el desarrollo. Se propone:

#### Fase 1: Preparación (semana 1-2)
1. Inicializar proyecto con Vite + React + TypeScript:
   ```bash
   npm create vite@latest react-app -- --template react-ts
   cd react-app
   npm install tailwindcss @tailwindcss/vite
   ```
2. Configurar `tailwind.config.js` con los tokens de diseño actuales:
   - `accent: '#fcad04'`, fondo oscuro, tipografía Outfit
3. Configurar `vite.config.ts` para output a `dist/` y copiar a `android_app/app/src/main/assets/`.
4. Añadir script `sync-assets.ps1` actualizado.

#### Fase 2: Componentes Core (semana 2-4)
Descomponer el monolito actual en componentes:

| Componente | Props | Sustituye en `script.js` |
|---|---|---|
| `<Player>` | `streamUrl, isPlaying, onTogglePlay` | Líneas 200-225 |
| `<NowPlayingCard>` | `title, artist, albumArt, isPlaying` | Líneas 42-55 (HTML) |
| `<VolumeSlider>` | `volume, onChange` | Líneas 245-266 |
| `<Visualizer>` | `isPlaying` | Líneas 503-514 |
| `<AlbumArt>` | `src, isPlaying` | Líneas 36-40 (CSS wrapper) |
| `<HistoryPanel>` | `history[], onClose` | Líneas 279-394 |
| `<BibleCard>` | — | Líneas 517-548 |
| `<BottomNav>` | `activeTab, onTabChange` | Líneas 396-415 |
| `<Starfield>` | — | Líneas 419-500 |

#### Fase 3: Integración con Puente Nativo (semana 4-6)
- Crear hook `useAndroidBridge()` que expone `isAndroid, play, pause, setVolume, getVolume, updateMetadata`.
- Crear hook `useNativeMetadata()` que escucha `window._onNativeMetadata`.
- Tipar el objeto `Android` global con `declare global { interface Window { Android: ... } }`.

#### Fase 4: Refinamiento y Despliegue (semana 6-8)
- Migrar el historial de localStorage a un store Zustand (o mantener localStorage).
- Integrarlo en el build pipeline de Gradle (tarea `preBuild` que ejecuta `npm run build`).
- Probar en WebView Android (sin livereload, con assets empaquetados).

### No Migrar (se mantiene en vanilla)
- **Canvas starfield**: No hay beneficio real en React para animaciones requestAnimationFrame.
- **Service Worker**: No aplica dentro de WebView nativo (`file://`).
- **Manifest JSON**: Sigue siendo necesario para PWA independiente.

---

## 4. Roadmap con Hitos y Dependencias

### Hito 1: Metadatos SSE nativos (mes 1)
| Semana | Tarea | Dependencia |
|---|---|---|
| 1 | Implementar `startNativeMetadataPolling()` en AudioService con corrutinas + flow | — |
| 1 | Manejar reconexión con backoff + jitter | — |
| 1 | Añadir canal inverso: AudioService → WebView vía `evaluateJavascript` | — |
| 2 | Añadir `window._onNativeMetadata` en script.js como fallback | Hito 1.1 |
| 2 | Unificar fetch de álbum art (solo nativo, JS lo recibe por canal inverso) | Hito 1.1 |
| 2 | Pruebas: pausar/reanudar app, notificación actualizada en segundo plano | — |

### Hito 2: Frontend React + Tailwind (mes 2)
| Semana | Tarea | Dependencia |
|---|---|---|
| 3 | Inicializar Vite + React + TS + Tailwind | — |
| 3 | Configurar build pipeline + sync-assets | — |
| 3-4 | Crear componentes: `Player`, `NowPlayingCard`, `VolumeSlider`, `Visualizer` | — |
| 4 | Crear componentes: `HistoryPanel`, `BibleCard`, `BottomNav`, `Starfield` | — |
| 4 | Hook `useAndroidBridge()` + `useNativeMetadata()` | Hito 1 |
| 5 | Conectar componentes al puente nativo | Hito 2.4 |
| 5 | Migrar historial (localStorage) a store | — |
| 6 | Probar en WebView real, ajustar estilos Tailwind | — |

### Hito 3: Refinamiento y Despliegue (mes 3)
| Semana | Tarea | Dependencia |
|---|---|---|
| 7 | Añadir ESLint + Prettier a React app | — |
| 7 | Integrar build de React en Gradle (tarea `preBuild`) | Hito 2 |
| 7 | Probar en múltiples dispositivos (API 24-35) | — |
| 8 | Documentar componentes nuevos en Storybook (opcional) | — |
| 8 | Release: tag + build final + actualizar REPORTE_TÉCNICO | — |

### Diagrama de Dependencias

```
Hito 1 (SSE nativo)
  └─ Sin dependencias externas
  └─ Requiere solo cambios en Kotlin + 1 listener en JS

Hito 2 (React)
  └─ Depende de Hito 1 para el hook useNativeMetadata()
  └─ Puede empezar en paralelo con componentes visuales (sin puente)

Hito 3 (Despliegue)
  └─ Depende de Hito 1 + Hito 2 completos
```

---

## 5. Riesgos y Mitigaciones

| Riesgo | Impacto | Probabilidad | Mitigación |
|---|---|---|---|
| **SSE nativo bloquea el servicio** al no parsear correctamente el stream | Alto | Media | Usar `Channel`/`Flow` de corrutinas; nunca `readLine()` directo sin `isActive` check |
| **Reconexión infinita** si Zeno.fm cambia su API SSE | Medio | Baja | Máximo 5 reintentos → detener polling y esperar reinicio manual; loggear error |
| **WebView no disponible** cuando AudioService intenta `evaluateJavascript` | Medio | Alta | Usar `?.let` + `try/catch`; el fallback JS igual funciona |
| **React app no cabe en WebView** por tamaño de bundle | Alto | Baja | Code splitting + lazy loading de HistoryPanel; target `es2015` en Vite |
| **Pérdida de historial** al cambiar de localStorage a store | Medio | Media | Estrategia de migración: leer localStorage en init, escribir en ambos durante transición |
| **Team no conoce React/TS** | Alto | Alta | Asignar 1 semana de capacitación + pair programming en primer componente |
| **Cambios simultáneos** en SSE y React causan regresiones | Alto | Media | Feature flags: mantener `window._onNativeMetadata` y SSE JS como fallback |

---

## 6. Tiempos Estimados

| Fase | Esfuerzo | Dedicación | Calendario |
|---|---|---|---|
| **Hito 1: SSE Nativo** | 40h (1 semana) | Full-time | Semana 1-2 |
| **Hito 2: React + Tailwind** | 160h (4 semanas) | Full-time | Semana 3-6 |
| **Hito 3: Refinamiento** | 80h (2 semanas) | Full-time | Semana 7-8 |
| **Total** | **280h (7 semanas)** | — | **~2 meses calendario** |

### Desglose por Archivo (SSE Nativo)
| Archivo | Cambio | Esfuerzo |
|---|---|---|
| `AudioService.kt` | +~80 líneas: polling SSE, flow, reconexión, fetch álbum art unificado | 20h |
| `MainActivity.kt` | +~5 líneas: método `evaluateInWebView()` | 2h |
| `script.js` | +~15 líneas: listener `window._onNativeMetadata` | 3h |
| Pruebas | Validar estado de notificación en background, reconexión | 10h |
| Buffer | Documentación, fixes imprevistos | 5h |

### Desglose por Componente (React)
| Componente | Líneas actuales | Líneas React estimadas | Esfuerzo |
|---|---|---|---|
| `Player + NowPlayingCard` | ~80 (HTML+JS+CSS) | ~120 (TSX+Tailwind) | 16h |
| `VolumeSlider` | ~30 | ~40 | 6h |
| `Visualizer` | ~30 | ~40 | 6h |
| `HistoryPanel` | ~100 | ~150 | 20h |
| `BibleCard` | ~40 | ~60 | 8h |
| `BottomNav` | ~50 | ~60 | 8h |
| Hooks (`useAndroidBridge`, `useNativeMetadata`) | — | ~80 | 16h |
| Config (Vite, Tailwind, Gradle) | — | ~50 | 20h |
| **Total parcial** | **~330** | **~600** | **100h** |

---

## 7. Recomendaciones Finales

1. **Priorizar SSE nativo sobre React.** El beneficio de metadatos en segundo plano es tangible para el usuario final y resuelve un bug real; React es principalmente calidad interna de código.
2. **No borrar el SSE JS** al migrar al nativo. Mantenerlo como respaldo si el servicio nativo falla o si la app se ejecuta fuera de Android (PWA en navegador).
3. **Comenzar React con un solo componente** (ej: `NowPlayingCard`) y probarlo en WebView antes de migrar el resto.
4. **Unificar fetch de álbum art en Kotlin.** Una vez que el SSE nativo funcione, desactivar `fetchAlbumArt()` en JS y recibir la art URL por el canal inverso.
5. **Agregar tests** de regresión para el historial (localStorage) antes de migrarlo a un store React.
6. **Actualizar `.gitignore`** para incluir `/react-app/node_modules/` y `/react-app/dist/`.
