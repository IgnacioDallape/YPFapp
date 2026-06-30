# RemitosApp

App **mobile-first (PWA)** para gestión de remitos de carga de combustible de una flota.
Los choferes suben remitos con fotos desde el celular; el admin los revisa, registra pagos
(totales o **parciales por litros**), lleva la deuda de combustible y ve el **historial de
consumo (L/100km) viaje a viaje**.

Stack: HTML + CSS + **un solo `js/app.js` en vanilla JS** (sin framework, **sin build step**)
+ **Supabase** (base de datos + storage de fotos) cargado por CDN.

> 📚 Documentación completa del proyecto en [`docs/`](docs/). Empezá por [`docs/README.md`](docs/README.md).

## Setup rápido

### 1. Supabase — Base de datos
1. Crear proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, pegar y ejecutar [`supabase/schema.sql`](supabase/schema.sql)
   (es **aditivo/idempotente**: no borra datos, se puede correr sobre una base existente).
3. Si ya tenías una base de una versión anterior, correr también las migraciones de
   [`supabase/migrations/`](supabase/migrations/) (ej. `0001_historial_pagos.sql`).
4. En **Storage → Buckets**, crear un bucket **público** llamado **`remitos-fotos`**.

### 2. Credenciales
Abrir [`js/app.js`](js/app.js) y completar las constantes al inicio:

```js
const SUPABASE_URL      = 'https://xxxx.supabase.co';   // Project URL
const SUPABASE_ANON_KEY = 'eyJh...';                    // anon public key
const ADMIN_PASSWORD    = 'ypf2024';                    // cambiar por algo seguro
```

Las primeras dos están en Supabase → **Settings → API**.

### 3. Deploy / correr local
No hay build step. Subir los archivos a cualquier hosting estático (Vercel, Netlify, etc.).
Para probar local hace falta servirla **desde la raíz** (por las rutas absolutas del
manifest/SW). Ver [`docs/04-operacion.md`](docs/04-operacion.md).

---

## Uso

### Choferes
- Login con **nombre + PIN de 4 dígitos** (el chofer tiene que existir en la tabla `choferes`).
- Cargan remitos con: fecha, N° de remito, litros, **km del camión**, **foto del odómetro
  (obligatoria)**, comentarios y fotos del remito. Las fotos se comprimen en el celular antes
  de subir.

### Admin
- En la bienvenida: tocar **"Soy administrador"** e ingresar la contraseña.
- **3 pestañas**:
  - **Pendientes** — remitos por cobrar (incluye parciales y pagados aún no archivados) +
    la **deuda de combustible**. Marcar un remito como pagado **ya no lo hace desaparecer**.
  - **Todos** — todos los remitos, con filtros por chofer y mes, **borrado individual**, una
    sección colapsable de **Archivados**, y dos herramientas: **➕ Subir remito** y **👤 Choferes**.
  - **Historial** — consumo **L/100km por viaje** (de una carga a la siguiente). Colapsado
    muestra solo el consumo; al desplegar aparecen km recorridos y litros. Filtra por mes y chofer.
- **Subir remito por un chofer**: desde "Todos", el admin puede cargar un remito (con fotos) a
  nombre de cualquier chofer, sin desloguearse — útil cuando un chofer se olvidó de cargarlo.
- **Choferes (alta/baja)**: crear un chofer (nombre + PIN de 4 dígitos) o eliminarlo. Eliminar un
  chofer borra también sus remitos (se avisa antes).
- **Pago parcial**: en cada remito se puede registrar cuántos **litros** se pagaron (útil
  cuando una orden junta 2 remitos). La deuda resta lo ya pagado.
- **Archivar pagados**: saca de Pendientes los remitos pagados al 100% **sin borrarlos**
  (quedan en Todos y en el Historial; se pueden desarchivar).
- **Eliminar** (en Todos): borra un remito y sus fotos definitivamente.

---

## Estructura

```
index.html             Shell HTML + registro del service worker
css/styles.css         Todos los estilos
js/app.js              Toda la lógica (vanilla JS)
sw.js                  Service worker (cache versionado)
manifest.json          PWA manifest
icons/                 Íconos PWA
supabase/schema.sql    Esquema real (aditivo)
supabase/migrations/   Migraciones incrementales
docs/                  Documentación del proyecto
```
