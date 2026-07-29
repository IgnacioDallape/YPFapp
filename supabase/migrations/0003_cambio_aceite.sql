-- RemitosApp — Migración 0003: cambio de aceite
-- =====================================================================
-- Marca en qué remito se hizo un cambio de aceite. La app usa el km de
-- ese remito como base para avisar cuando el chofer recorra ~29.000 km.
-- Aditivo, backward-compatible (se puede correr en cualquier momento) y
-- NO borra ni modifica ningún dato existente.
-- =====================================================================

alter table remitos add column if not exists cambio_aceite boolean not null default false;
