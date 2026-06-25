# Documentación — RemitosApp

Contexto completo del proyecto, verificado contra el código real (`js/app.js`).
Leé esto antes de tocar código.

## Índice

1. [Arquitectura](01-arquitectura.md) — stack, archivos, flujo de arranque, PWA/Service Worker.
2. [Modelo de datos](02-modelo-datos.md) — tablas reales, columnas, **estados de pago**,
   fórmula de **deuda** y de **consumo L/100km**.
3. [Funcionalidad](03-funcionalidad.md) — flujo del chofer y del admin (las 3 pestañas),
   pago parcial, archivar, historial, borrado.
4. [Operación](04-operacion.md) — correr local, credenciales, deploy, **bump de versión/SW**.
5. [Notas y riesgos](05-notas.md) — decisiones, riesgos conocidos, deuda técnica, ideas.

## TL;DR

- **Qué es**: PWA mobile-first para que choferes carguen remitos de combustible (con fotos)
  y un admin los gestione: pagos (totales o **parciales por litros**), deuda, e **historial
  de consumo L/100km viaje a viaje**.
- **Stack**: vanilla JS (`js/app.js`, ~1700 líneas) + Supabase (CDN). **Sin build step.**
- **Roles**: chofer (login nombre + PIN) y admin (contraseña, hardcodeada en el JS).
- **Es una herramienta personal/interna** — no está pensada para escala masiva ni para
  abrirse a usuarios no confiables (ver [05-notas.md](05-notas.md)).
