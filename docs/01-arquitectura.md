# 01 — Arquitectura

## Stack

- **Frontend**: HTML + CSS + **un solo `js/app.js` en vanilla JS** (sin framework, sin bundler,
  **sin build step**). Todo el render es por templates de strings + `innerHTML`.
- **Backend**: [Supabase](https://supabase.com) (Postgres + Storage), cargado por CDN
  (`@supabase/supabase-js@2`).
- **Fuente**: DM Sans (Google Fonts). Tema beige/dorado (`--color1..5`, ver `css/styles.css`).
- **PWA**: `manifest.json` + `sw.js` (service worker) → instalable en Android/iOS.

## Archivos

```
index.html             Shell. Carga supabase-js (CDN), css, app.js. Registra el SW
                       y maneja el banner "nueva versión".
css/styles.css         Todos los estilos. Variables de tema en :root.
js/app.js              TODA la lógica: estado, init, pantallas (welcome/chofer/admin),
                       render, validaciones, llamadas a Supabase.
sw.js                  Service worker. Cache-first SOLO de assets propios; deja pasar
                       Supabase/CDN. Cache versionado (const CACHE).
manifest.json          PWA manifest (íconos, theme color, etc.).
icons/                 Íconos PWA (192/512 png + svg).
supabase/schema.sql    Esquema real (aditivo/idempotente).
supabase/migrations/   Migraciones incrementales (ej. 0001_historial_pagos.sql).
```

## Estado en runtime

Un único objeto `S` (en `js/app.js`) con el estado de la sesión y la UI:

- `deviceId` (getter, persistido en `localStorage`), `choferId`, `nombre`, `isAdmin`.
- `adminTab`: `'pendientes' | 'todos' | 'historial'`.
- `filtroChofer`, `filtroMes`: filtros del admin.
- `fotosStaged`, `fotoKm`: fotos en memoria del formulario del chofer.
- `lightboxUrls`, `lightboxIdx`: visor de fotos.
- `precioLitro`: precio por litro (de la tabla `config`) para calcular la deuda.

Persistencia local (`localStorage`): `ypf_device_id`, `ypf_chofer_id`, `ypf_nombre`,
`ypf_is_admin`.

## Flujo de arranque (`init()`)

1. Se ejecuta en `DOMContentLoaded`.
2. Si no hay credenciales de Supabase → pantalla de bienvenida.
3. Si `S.isAdmin` (cacheado) → `renderAdmin()`.
4. Si hay sesión de chofer cacheada → **revalida** el id contra la DB (por nombre, luego por
   device) para evitar errores de foreign key, y rinde la pantalla del chofer.
5. Si no hay sesión → busca el device en `choferes`; si existe entra, si no, bienvenida.

Toda llamada a Supabase está envuelta en `try/catch` para degradar a la bienvenida/sesión
cacheada sin romper la UI offline.

## PWA / Service Worker

- `sw.js` cachea los assets propios (`/`, `index.html`, `css`, `js`, `manifest`, íconos) con
  estrategia **cache-first**. Las requests a Supabase/fonts/CDN **no** se cachean.
- Versionado: la constante `CACHE` (`remitosapp-vNN`). **Al deployar un cambio hay que
  bumpear `CACHE` en `sw.js` y `APP_VERSION` en `js/app.js`** (ver [04-operacion.md](04-operacion.md)),
  si no el SW sigue sirviendo la versión vieja cacheada.
- Cuando hay un SW nuevo, `index.html` muestra un banner "✨ Nueva versión disponible" y, al
  confirmar, activa el SW (`SKIP_WAITING`) y recarga.
