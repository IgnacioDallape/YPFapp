-- RemitosApp — Migración 0001: pagos parciales + archivar
-- =====================================================================
-- Correr en el SQL Editor de Supabase. Es ADITIVO e IDEMPOTENTE:
-- solo agrega columnas/índices, hace un backfill no destructivo y
-- NUNCA borra datos. Se puede correr más de una vez sin problema.
-- =====================================================================

-- 1) Litros ya pagados de cada remito (para pago parcial).
--    0 = pendiente · entre 0 y litros = parcial · >= litros = pagado.
alter table remitos
  add column if not exists litros_pagados numeric(10,2) not null default 0;

-- 2) Archivado: "Limpiar pagados" archiva en vez de borrar.
--    Los archivados salen de Pendientes pero siguen en Todos e Historial.
alter table remitos
  add column if not exists archivado boolean not null default false;

create index if not exists idx_remitos_archivado on remitos(archivado);

-- 3) Backfill seguro: los remitos que ya estaban marcados como pagados
--    se consideran pagados al 100% (litros_pagados = litros).
--    No toca los que ya tengan un valor cargado.
update remitos
   set litros_pagados = coalesce(litros, 0)
 where pagado = true
   and litros_pagados = 0;
