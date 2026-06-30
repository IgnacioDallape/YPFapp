-- RemitosApp — Migración 0002: destinos opcionales
-- =====================================================================
-- Los choferes ya no cargan "destino ida / vuelta", así que destino_ida
-- deja de ser obligatorio. Aditivo y seguro: hace la columna NULLABLE
-- (más permisiva), NO borra ni modifica ningún dato existente.
-- Es backward-compatible: el código viejo que mandaba un valor sigue
-- funcionando, así que se puede correr en cualquier momento.
-- =====================================================================

alter table remitos alter column destino_ida drop not null;
