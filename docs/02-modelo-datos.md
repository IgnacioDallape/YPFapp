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
| `cambio_aceite`  | boolean     | se hizo cambio de aceite en este remito (base para el aviso) |
| `efectivo`       | boolean     | pagado en efectivo → fuera de la deuda, pero cuenta en el consumo |
| `unir_anterior`  | boolean     | tanque no lleno → fusiona el consumo con la carga anterior |
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

### Formaciones: el km sigue al CAMIÓN — `computeChains()`
El odómetro es del camión, no del chofer. Cuando los choferes rotan de camión, el historial
de un chofer mezcla dos odómetros. Sin tocar datos, la app reconstruye cada camión ("cadena"):
1. Por chofer, en orden cronológico, se corta un **tramo** cada vez que el km salta (sube o baja)
   más de `VIAJE_MAX_KM` (50.000) → se subió a otro camión.
2. Cada tramo nuevo (salvo el primero de cada chofer) se **enlaza** con el tramo de cualquier
   chofer que **terminó antes** y cuyo último km queda justo debajo (0..50.000) → mismo camión,
   otra formación. Un camión que seguía en uso no se enlaza.

Consumo, uniones (`unir_anterior`) y aceite se calculan **por camión**. Ej.: Rolando pasa al
camión que manejaba Fabian → su 1ª carga se mide desde la última de Fabian (1.218.556 →
1.220.376 = 1.820 km). El viaje se atribuye al chofer de la carga nueva. Límite: si dos camiones
tienen odómetros a menos de 50.000 km entre sí, el enlace automático puede no distinguirlos.

### Consumo por viaje (pestaña Historial) — `computeViajes()`
Un **viaje** es el tramo entre dos cargas consecutivas del **mismo camión** (ordenadas por km),
aunque las haya hecho otro chofer (ver Formaciones):
```
distancia (km) = km(carga nueva) − km(carga anterior)
litros         = litros cargados en la carga nueva   (rellenan lo consumido en el tramo)
consumo        = litros / distancia × 100   →  L/100km
```
Se descartan tramos con distancia ≤ 0 o sin litros válidos. El historial considera **todos**
los remitos (incluso archivados); solo desaparece un viaje si se **borra** uno de sus remitos.

**Tanque no lleno (`unir_anterior`)**: si una carga no llenó el tanque, el consumo "tanque lleno
a tanque lleno" da mal. Marcándola con `unir_anterior=true`, `computeViajes` la **fusiona** con la
carga anterior: suma los litros y avanza el km/fecha, calculando el consumo sobre el tramo
combinado (encadena si hay varias seguidas). No afecta la deuda, solo el consumo.
