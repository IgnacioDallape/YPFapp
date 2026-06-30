# 05 — Notas, riesgos y deuda técnica

## Decisiones de diseño

- **Pagos no destructivos**: marcar pagado no oculta el remito. "Archivar pagados" lo saca de
  Pendientes pero lo conserva (en Todos e Historial). El **único** borrado real es el botón
  🗑 por remito en "Todos".
- **Pago parcial por litros**: el admin carga cuántos litros se pagaron. La deuda resta lo
  pagado. Sirve cuando una orden junta 2 remitos.
- **Historial sobre todo el histórico**: se calcula con todos los remitos (incluso
  archivados); el filtro de mes se aplica al viaje, no a la query, para no cortar el consumo
  en los bordes de mes.

## Riesgos de seguridad conocidos (aceptados — herramienta personal)

> Esta app está pensada como herramienta **personal/interna**, no para abrirse a muchos
> usuarios ni a gente no confiable. Con ese supuesto, lo de abajo es aceptable; si algún día
> se quiere abrir, hay que resolverlo.

- **RLS deshabilitado** + anon key pública → cualquiera con la app (o la key) puede
  leer/escribir/borrar toda la base. No hay autorización real por rol.
- **`ADMIN_PASSWORD` en el cliente**: visible en el código. No es un control de seguridad
  real, solo una barrera de UI.
- **PIN en texto plano** en `choferes.pin`, login validado del lado del cliente.

Para endurecer (si se necesitara): migrar a **Supabase Auth** (usuarios/sesiones) + **RLS**
por rol, y sacar la contraseña/PIN del cliente (Edge Functions). Es un cambio grande que
toca el login.

## Auditoría 2026-06-30 (v32)

Pasada de tests completa: suite automatizada del motor (`tests/engine.test.mjs`, 78 casos) +
E2E en navegador con datos reales + auditoría adversarial multi-agente (20 hallazgos confirmados).

**Arreglado en v32:**
- XSS almacenado: `comentarios` y `numero` del chofer ahora se escapan con `esc()` en la card y
  el editor (faltaban; el resto de los campos ya escapaban).
- Sesión trabada: si un chofer fue borrado, `init()` ahora limpia la sesión cacheada y vuelve al
  login (antes quedaba con un `choferId` fantasma y no podía enviar).
- Historial: `computeViajes` coacciona `litros` a número (`parseFloat`) — evita que un `numeric`
  serializado como string concatene en lugar de sumar.
- Foto del km: se chequea el error del `update(foto_km_url)` (antes un fallo de ese update se
  tragaba silenciosamente).
- Pago: se clampa `litros_pagados` a 0 cuando `litros <= 0` (editor y pago parcial) — evita un
  estado "parcial" sin litros que cobrar.
- Borrado de remito: un solo `delete` sobre `remitos` (el FK cascade borra las fotos) — atómico.

**Limitaciones conocidas (no son bugs de la operación actual; pendientes si se necesita):**
- **Consumo por odómetro**: `computeViajes`/separador asumen un odómetro monótono por chofer
  (un camión por chofer). Si un chofer cambia de camión o se resetea el km, el cálculo de un
  viaje puede distorsionarse. No hay concepto de "camión/patente". El separador inline de la
  lista, además, empareja cards adyacentes del subconjunto filtrado (el **Historial** es la
  fuente confiable de consumo).
- **Fotos huérfanas en Storage**: borrar remito/chofer borra las filas pero no los binarios del
  bucket (cuesta espacio, no pierde datos).
- **Reintento de fotos**: si fallan TODAS las fotos al enviar, el remito queda guardado con sus
  datos pero sin evidencia; el chofer no puede reintentar (el admin sí, por el editor).
- Menores: `ilike(nombre)` trata `%`/`_` como comodines; fuga de object-URLs de previews al
  enviar; `compressImage` no respeta orientación EXIF; `archivarPagados` calcula los IDs antes
  de confirmar (TOCTOU); fuga de un listener de `document` al filtrar con un dropdown abierto.

## Deuda técnica / mejoras

- **Sin paginación**: "Todos" e "Historial" traen todos los remitos. Bien para un volumen
  chico; con miles de filas convendría paginar.
- **Fotos huérfanas en Storage**: al borrar un remito se borran las filas de `remito_fotos`
  y el remito, pero **no** los archivos del bucket. Quedan huérfanos (igual que antes).
  Mejora: borrar también de Storage (`sb.storage.from('remitos-fotos').remove([...])`).
- **`js/app.js` monolítico** (~1700 líneas, todo junto). Si crece, conviene separar
  data-access / render / estado.
- **Sin tests automatizados**. Las funciones puras (`computeViajes`, `estadoPago`,
  `litrosPendientes`) son fáciles de testear si en algún momento se agrega un runner.
- **`renderConsumoSeparator` vs `computeViajes`**: dos caminos que calculan lo mismo (consumo
  entre cargas). Se podrían unificar.
