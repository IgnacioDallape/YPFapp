-- RemitosApp — Migración 0006: km de cambio de aceite manual por chofer
-- =====================================================================
-- Cuando un chofer se sube a otro camión, el contador "km desde el último
-- cambio de aceite" lo setea el admin a mano por chofer (no se mueve ni se
-- toca ningún remito). Se interpreta como un punto de cambio virtual en el
-- odómetro = aceite_base_km − aceite_base, anclado a la última carga del
-- chofer (aceite_base_fecha) y aplicado solo de esa fecha en adelante.
-- Aditivo, backward-compatible, NO borra ni modifica datos existentes.
-- =====================================================================

alter table choferes add column if not exists aceite_base       numeric;   -- km desde el último cambio (seteado a mano)
alter table choferes add column if not exists aceite_base_km    numeric;   -- odómetro de la carga a la que se ancló
alter table choferes add column if not exists aceite_base_fecha date;      -- fecha de esa carga (se aplica de acá en adelante)
