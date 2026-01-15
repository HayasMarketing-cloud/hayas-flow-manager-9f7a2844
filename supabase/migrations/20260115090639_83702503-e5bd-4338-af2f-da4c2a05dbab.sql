-- Primero eliminar el default de la columna
ALTER TABLE liquidations ALTER COLUMN status DROP DEFAULT;

-- Crear nuevo enum con los estados correctos
CREATE TYPE liquidation_status_new AS ENUM (
  'draft', 
  'validated', 
  'sent', 
  'accepted', 
  'pending_payment', 
  'paid'
);

-- Cambiar la columna al nuevo tipo
ALTER TABLE liquidations 
  ALTER COLUMN status TYPE liquidation_status_new 
  USING status::text::liquidation_status_new;

-- Eliminar el enum antiguo
DROP TYPE liquidation_status;

-- Renombrar el nuevo enum
ALTER TYPE liquidation_status_new RENAME TO liquidation_status;

-- Restaurar el default
ALTER TABLE liquidations ALTER COLUMN status SET DEFAULT 'draft'::liquidation_status;