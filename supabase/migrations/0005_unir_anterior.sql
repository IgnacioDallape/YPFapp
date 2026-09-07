-- RemitosApp — Migración 0005: unir cargas (tanque no lleno)
-- =====================================================================
-- Cuando NO se llena el tanque completo, el consumo "tanque lleno a tanque
-- lleno" da mal. Marcando un remito con unir_anterior=true, sus litros se
-- combinan con la carga anterior sobre el tramo total → consumo real.
-- Aditivo, backward-compatible, NO borra ni modifica datos existentes.
-- =====================================================================

alter table remitos add column if not exists unir_anterior boolean not null default false;
