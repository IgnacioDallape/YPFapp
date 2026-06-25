# 02 — Modelo de datos

Esquema **real** usado por la app (fuente de verdad: `js/app.js`). El archivo
`supabase/schema.sql` lo refleja y es aditivo/idempotente.

## Tablas

### `choferes`
| Columna     | Tipo      | Notas |
|-------------|-----------|-------|
| `id`        | uuid PK   | |
| `nombre`    | text      | |
| `pin`       | text      | PIN de 4 dígitos. Login = `nombre` + `pin`. |
| `device_id` | text uniq | Identifica el dispositivo; se actualiza al loguear. |
| `is_admin`  | boolean   | |
| `created_at`| timestamptz | |

### `remitos`
| Columna          | Tipo        | Notas |
|------------------|-------------|-------|
| `id`             | uuid PK     | |
| `chofer_id`      | uuid FK     | → `choferes.id` (on delete cascade) |
| `fecha_carga`    | date        | |
| `numero`         | text        | N° de remito |
| `destino_ida`    | text        | |
| `destino_vuelta` | text        | |
| `litros`         | numeric     | litros cargados (total del remito) |
| `km`             | integer     | km del camión al cargar |
| `foto_km_url`    | text        | URL de la foto del odómetro |
| `comentarios`    | text        | |
| `pagado`         | boolean     | `true` = pagado al 100% |
| `fecha_pago`     | date        | |
| `litros_pagados` | numeric     | **pago parcial**: litros ya pagados (default 0) |
| `archivado`      | boolean     | `true` = archivado ("Limpiar/Archivar pagados") |
| `created_at`     | timestamptz | |

### `remito_fotos`
| Columna       | Tipo    | Notas |
|---------------|---------|-------|
| `id`          | uuid PK | |
| `remito_id`   | uuid FK | → `remitos.id` (on delete cascade) |
| `storage_url` | text    | URL pública en Storage |
| `created_at`  | timestamptz | |

### `config` (key/value)
| Columna | Tipo | Notas |
|---------|------|-------|
| `key`   | text PK | ej. `precio_litro` |
| `value` | text    | guardado como string, se parsea a número |

## Storage

Bucket **público** `remitos-fotos`. Path de subida:
`<chofer_id>/<remito_id>/<archivo>.jpg`. (Ojo: el bucket es `remitos-fotos` con "s" — una
doc vieja lo nombraba `remito-fotos`, era incorrecto.)

## Estados de pago (derivados de litros)

No hay una columna "estado": se calcula con `estadoPago(r)` a partir de `litros` y
`litros_pagados`:

- `litros_pagados = 0` (y no `pagado`) → **pendiente**
- `0 < litros_pagados < litros` → **parcial**
- `litros_pagados >= litros` (o `pagado = true`) → **pagado**

Helpers en `js/app.js`: `litrosTotal(r)`, `litrosPagadosOf(r)`, `litrosPendientes(r)`,
`estadoPago(r)`.

## Fórmulas

### Deuda de combustible (pestaña Pendientes)
```
deuda = Σ litrosPendientes(r) × precio_litro     (sobre remitos NO archivados)
litrosPendientes(r) = pagado ? 0 : max(0, litros − litros_pagados)
```

### Consumo por viaje (pestaña Historial) — `computeViajes()`
Un **viaje** es el tramo entre dos cargas consecutivas del **mismo chofer** (ordenadas por km):
```
distancia (km) = km(carga nueva) − km(carga anterior)
litros         = litros cargados en la carga nueva   (rellenan lo consumido en el tramo)
consumo        = litros / distancia × 100   →  L/100km
```
Se descartan tramos con distancia ≤ 0 o sin litros válidos. El historial considera **todos**
los remitos (incluso archivados); solo desaparece un viaje si se **borra** uno de sus remitos.
