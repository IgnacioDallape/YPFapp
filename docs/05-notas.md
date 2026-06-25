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
