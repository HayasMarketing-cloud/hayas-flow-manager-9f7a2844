-- 1. Crear enum specialist_type
CREATE TYPE public.specialist_type AS ENUM ('interno', 'freelance', 'partner');

-- 2. Añadir columna type a specialists
ALTER TABLE public.specialists 
ADD COLUMN type public.specialist_type DEFAULT 'freelance';

-- 3. Eliminar columnas que ya no se usan
ALTER TABLE public.specialists 
DROP COLUMN IF EXISTS cost_type,
DROP COLUMN IF EXISTS default_rate,
DROP COLUMN IF EXISTS liquidation_terms,
DROP COLUMN IF EXISTS phone,
DROP COLUMN IF EXISTS specialties;