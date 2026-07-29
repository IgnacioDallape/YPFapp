-- RemitosApp — supabase/schema.sql
-- =====================================================================
-- Esquema REAL de la app (auditado contra js/app.js).
-- Todo es ADITIVO e idempotente (if not exists / add column if not exists):
-- correrlo sobre una base existente NO borra ni pisa datos.
--
-- Para una base nueva: correr este archivo entero.
-- Para una base existente: ya está cubierto; además ver supabase/migrations/.
-- =====================================================================

-- ── Tablas ───────────────────────────────────────────────────────────

create table if not exists choferes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  pin        text,                       -- PIN de 4 dígitos (login: nombre + pin)
  device_id  text unique not null,
  is_admin   boolean default false,
  created_at timestamptz default now()
);

create table if not exists remitos (
  id             uuid primary key default gen_random_uuid(),
  chofer_id      uuid references choferes(id) on delete cascade,
  fecha_carga    date not null,
  numero         text,                   -- N° de remito
  destino_ida    text,                   -- opcional (los choferes ya no lo cargan)
  destino_vuelta text,
  litros         numeric(10,2),
  km             integer,                -- kilómetros del camión al cargar
  foto_km_url    text,                   -- foto del odómetro
  comentarios    text,
  pagado         boolean default false,
  fecha_pago     date,
  litros_pagados numeric(10,2) not null default 0,   -- pago parcial (litros)
  archivado      boolean not null default false,     -- "Limpiar pagados" archiva
  cambio_aceite  boolean not null default false,     -- se hizo cambio de aceite en este remito
  created_at     timestamptz default now()
);

create table if not exists remito_fotos (
  id          uuid primary key default gen_random_uuid(),
  remito_id   uuid references remitos(id) on delete cascade,
  storage_url text not null,
  created_at  timestamptz default now()
);

-- Config key/value (ej: precio_litro para el cálculo de deuda).
create table if not exists config (
  key   text primary key,
  value text
);

-- ── Columnas agregadas en migraciones (idempotente para bases viejas) ─
alter table choferes add column if not exists pin            text;
alter table remitos  add column if not exists numero         text;
alter table remitos  add column if not exists km             integer;
alter table remitos  add column if not exists foto_km_url    text;
alter table remitos  add column if not exists litros_pagados numeric(10,2) not null default 0;
alter table remitos  add column if not exists archivado      boolean not null default false;
alter table remitos  add column if not exists cambio_aceite  boolean not null default false;
alter table remitos  alter column destino_ida drop not null;   -- destinos opcionales

-- ── Índices ──────────────────────────────────────────────────────────

create index if not exists idx_choferes_device_id    on choferes(device_id);
create index if not exists idx_remitos_chofer_id      on remitos(chofer_id);
create index if not exists idx_remitos_pagado         on remitos(pagado);
create index if not exists idx_remitos_archivado      on remitos(archivado);
create index if not exists idx_remitos_fecha_carga    on remitos(fecha_carga);
create index if not exists idx_remito_fotos_remito_id on remito_fotos(remito_id);

-- ── Storage ──────────────────────────────────────────────────────────
-- Crear (una vez, desde el panel) un bucket PÚBLICO llamado: remitos-fotos
-- El código sube a: <chofer_id>/<remito_id>/<archivo>.jpg

-- ── RLS ──────────────────────────────────────────────────────────────
-- Herramienta interna/personal: RLS deshabilitado para simplificar.
-- (El acceso queda protegido por la anon key + la pantalla de login de la app.)
alter table choferes     disable row level security;
alter table remitos      disable row level security;
alter table remito_fotos disable row level security;
alter table config       disable row level security;
