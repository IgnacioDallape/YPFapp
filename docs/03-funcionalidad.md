# 03 — Funcionalidad

## Flujo del chofer

1. **Login**: nombre + PIN de 4 dígitos (`handleLogin`). El chofer debe existir en `choferes`
   con ese `pin`. Al entrar se actualiza su `device_id`.
2. **Cargar remito** (`renderChofer` / `submitRemito`). Campos obligatorios: fecha, N° de
   remito, litros, km, **foto del km**, y **al menos 1 foto del remito**. Comentarios opcional.
   (Los choferes ya **no** cargan destino ida/vuelta; `destino_ida` quedó nullable.)
3. Las fotos se **comprimen en el cliente** (`compressImage`, canvas, máx 1400px, JPEG 0.82)
   y se suben a Storage (`uploadFoto`). Si una foto falla, el remito igual queda guardado.
4. Auto-reparación: si el `chofer_id` cacheado quedó viejo (FK `23503`), re-busca el chofer
   por nombre y reintenta una vez.
5. Ve sus **últimos 3 remitos**.

## Flujo del admin

Entra desde "Soy administrador" + contraseña (`ADMIN_PASSWORD`). `renderAdmin` arma el shell
(header + 3 tabs + lightbox) y `loadAdminContent` rinde el contenido según `S.adminTab`.

### Pestaña "Pendientes"
- Query: remitos **no archivados** (`archivado = false`).
- **Card de deuda**: `Σ litrosPendientes × precio_litro`. El precio se edita con "✏ Precio"
  (se guarda en `config.precio_litro`).
- Acciones por remito según estado:
  - **pendiente** → "Marcar como pagado" + "Pago parcial".
  - **parcial** → "Completar pago" + "Editar parcial" + "↩ Marcar pendiente" + línea
    *"Pagado X de Y L · faltan Z L"*.
  - **pagado** → "↩ Marcar como pendiente".
- **Marcar como pagado NO hace desaparecer el remito** (sigue acá hasta archivarlo).

### Pestaña "Todos"
- Arriba, dos herramientas del admin: **➕ Subir remito** (cargar un remito por un chofer,
  ver más abajo) y **👤 Choferes** (alta/baja de choferes).
- Query: todos los remitos (activos + archivados). Filtros por **chofer** y **mes**
  (dropdowns custom: `bindChoferDropdown`, `bindMesPicker`).
- **Stats** del mes (remitos, litros, pendientes de pago).
- **Borrado individual** por remito (🗑, con confirmación) → borra el remito y sus fotos
  (`eliminarRemito`). Esto **sí** lo saca también del Historial.
- **"📦 Archivar pagados"** (`archivarPagados`): marca `archivado = true` en los remitos
  pagados al 100%. **No borra**: salen de Pendientes pero quedan acá (sección colapsable
  **Archivados**) y en el Historial. Cada archivado tiene "↩ Desarchivar".

### Pestaña "Historial"
- `loadHistorial` trae todo el histórico (incluye archivados), calcula viajes con
  `computeViajes` y filtra por mes (sobre la fecha de llegada del viaje) y por chofer.
- **Resumen**: km totales, litros totales y **L/100km promedio**.
- Lista de **viajes** (`renderViaje`, usando `<details>` nativo):
  - **Colapsado**: solo chofer + **L/100km**.
  - **Desplegado**: fechas del tramo + **km recorridos** + **litros** + **L/100km**.

## Pago sin asignar (saldo temporario)

Para cuando el admin paga (cheque/transferencia) pero todavía no sabe qué remitos cubre ese pago.

- En la card de deuda (Pendientes), botón **"💵 Registrar un pago"** → ingresa un monto en pesos.
- Ese monto (`config.pago_temporario`, no toca ningún remito) se **resta del saldo**:
  `saldo = deuda_real − pago_sin_asignar`. La deuda real (`Σ litros pendientes × precio`)
  **sigue corriendo**: si entran remitos nuevos, el saldo sube igual.
- Botón **"✓ Ya tengo las facturas"** → pone el pago sin asignar en 0 (el saldo vuelve a subir).
  A partir de ahí el admin marca los remitos reales como pagados y el saldo baja de nuevo, esta
  vez con los remitos marcados (`estadoPago`/`litros_pagados`).
- Es sólo un ajuste de **display sobre el total**: `loadPagoTemporario`/`savePagoTemporario`
  guardan en `config`, sin migración.

## Subir remito por un chofer (admin)

Botón **➕ Subir remito** en "Todos" → `renderAdminUploadRemito`. Reusa el **mismo formulario**
del chofer (`remitoFormHTML(true, choferes)`) pero con un **selector de chofer** arriba. El admin
elige el chofer, completa el remito (con fotos) y al enviar el remito queda cargado **a nombre de
ese chofer** (mismo `submitRemito`, que detecta el selector `f-chofer` y usa ese `chofer_id` para el
registro y los paths de Storage). Sirve para cuando un chofer se olvidó de cargar. Al terminar
vuelve al panel admin. No hace falta desloguear ni entrar como el chofer.

## Gestión de choferes (admin)

Botón **👤 Choferes** en "Todos" → `showUsuariosModal`. Permite:
- **Alta** (`addChofer`): nombre + PIN de 4 dígitos → crea un chofer con `is_admin=false` y un
  `device_id` temporal único (`crypto.randomUUID()`, se reemplaza por el real cuando el chofer
  entra). Evita duplicados por nombre. Es el equivalente por UI al `INSERT` manual en Supabase.
- **Baja** (`eliminarChofer`): elimina el chofer. ⚠️ Por el FK `on delete cascade`, **borra
  también todos sus remitos y fotos** — el confirm avisa cuántos remitos se van a perder.

A partir del alta, ese chofer entra con su nombre + PIN y funciona idéntico a los demás (sus
remitos, litros y consumo propios), sin tocar nada más.

## Cambio de aceite (admin)

Botón **🛢** al lado de "Editar" en cada card. Al marcarlo, ese remito queda como el punto
del último cambio de aceite (columna `remitos.cambio_aceite`) y su `km` es la base.

- `computeOilStatus` anota en cada remito `_oilKmDesde` = `km` del remito − `km` del último
  cambio de aceite del mismo chofer (con `km <= ` el de este). `null` si el chofer todavía no
  tiene ningún cambio marcado.
- Cada card muestra un chip de progreso **`🛢 X/30.000 km`**. Cuando `X ≥ 29.000`
  (`OIL_ALERT_KM`), el chip se pone rojo y aparece una **alerta en el remito**: *"Toca cambiar
  el aceite"*. El aviso es a los **29.000** (un poco antes de los 30.000 nominales).
- Marcar un nuevo cambio en un remito más nuevo **resetea** el conteo desde ahí.
- El aviso es **in-app** sobre la card. (Una notificación push al celular con la app cerrada
  sería una feature aparte más grande — Web Push + backend.)

## Editor de remito (admin)

`showEditRemito` permite corregir fecha, N° remito, litros, **km**, **litros pagados**,
destinos, comentarios, y agregar/quitar la foto del km y fotos del remito. Al guardar, si
`litros_pagados >= litros` el remito queda pagado; si es menor, parcial; si es 0, pendiente.

## Consumo entre cards (Pendientes/Todos)

Entre dos cards consecutivas del mismo chofer aparece un separador con km, litros y L/100km
(`renderConsumoSeparator`). Es la misma idea que el Historial, pero inline en la lista.
