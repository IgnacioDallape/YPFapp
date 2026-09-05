-- RemitosApp — Migración 0004: pagos en efectivo (fuera de cuenta corriente)
-- =====================================================================
-- Marca un remito como pagado en EFECTIVO: no suma a la deuda / cuenta
-- corriente, pero SÍ sigue contando en el consumo (historial / L·100km).
-- Aditivo, backward-compatible, NO borra ni modifica ningún dato existente.
-- =====================================================================

alter table remitos add column if not exists efectivo boolean not null default false;
