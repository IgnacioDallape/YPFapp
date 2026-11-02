-- RemitosApp — Migración 0007: unidades (camiones de la flota)
-- =====================================================================
-- Cada unidad (camión) se asigna a un chofer. El odómetro se muestra desde la
-- última carga del chofer; el "km desde el último cambio de aceite" se setea a
-- mano por unidad y alimenta el contador de aceite del chofer asignado.
-- NO mueve ni toca ningún remito. Aditiva, backward-compatible.
-- =====================================================================

create table if not exists unidades (
  id                uuid primary key default gen_random_uuid(),
  numero            text not null,                            -- N°/nombre del camión (ej. 2036, nl10)
  chofer_id         uuid references choferes(id) on delete set null,
  aceite_base       numeric,                                  -- km desde el último cambio de aceite (a mano)
  aceite_base_km    numeric,                                  -- odómetro de la carga a la que se ancló
  aceite_base_fecha date,                                     -- fecha de esa carga (se aplica de acá en adelante)
  created_at        timestamptz default now()
);

create index if not exists idx_unidades_chofer_id on unidades(chofer_id);

alter table unidades disable row level security;
