# 04 — Operación

## Tests

Suite del motor (lógica pura: estados de pago, deuda, consumo/viajes, formato, escape).
No tiene dependencias — carga `js/app.js` en un contexto `vm` con stubs:

```bash
node tests/engine.test.mjs    # 78 casos, ~instantáneo
```

## Correr en local

No hay build step, pero **hay que servir desde la raíz** (la app usa rutas absolutas:
`/manifest.json`, `/sw.js`, `/js/app.js`). Abrir el `index.html` con `file://` **no** funciona.

Opciones (cualquier server estático sirve):

```bash
# con npx serve (sirve la carpeta como raíz en el puerto 8000)
npx serve -l 8000 .

# o con cualquier otro server estático apuntando a la carpeta del proyecto
```

Luego abrir `http://localhost:8000`. El service worker funciona en `localhost`.
Si ves contenido viejo cacheado, hacé **hard refresh** (Ctrl/Cmd+Shift+R) o esperá el banner
de "nueva versión".

## Credenciales

Están **hardcodeadas** al inicio de `js/app.js`:

```js
const SUPABASE_URL      = '...';   // Supabase → Settings → API
const SUPABASE_ANON_KEY = '...';   // anon public key (segura de exponer)
const ADMIN_PASSWORD    = '...';   // ⚠️ visible en el código del cliente
```

La `anon key` es pública por diseño. La `ADMIN_PASSWORD` queda visible en el bundle del
cliente — aceptable por ser herramienta personal (ver [05-notas.md](05-notas.md)).

## Base de datos

- Base nueva: correr `supabase/schema.sql` entero en el **SQL Editor** de Supabase.
- Base existente: el `schema.sql` es **aditivo** (todo `if not exists`) → se puede correr sin
  miedo. Además correr las migraciones nuevas de `supabase/migrations/` (ej.
  `0001_historial_pagos.sql`, que agrega `litros_pagados` y `archivado` y hace un backfill
  no destructivo).
- Crear el bucket público `remitos-fotos` en Storage.

## Deploy

Subir los archivos a Vercel/Netlify/hosting estático. Auto-deploy desde el repo si está
conectado.

## ⚠️ Bump de versión (IMPORTANTE en cada deploy)

El service worker cachea los assets. Si cambiás `js/app.js` o `css/styles.css` **tenés que
subir la versión**, si no los usuarios siguen viendo lo viejo:

1. `js/app.js` → `const APP_VERSION = 'vNN · YYYY-MM-DD';`
2. `sw.js` → `const CACHE = 'remitosapp-vNN';`

(Usar el mismo `NN` en los dos.) Al deployar, el SW detecta el cambio y ofrece "Actualizar".
