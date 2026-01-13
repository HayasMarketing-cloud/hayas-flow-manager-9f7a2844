-- 1. Create new enum with all workflow states
CREATE TYPE public.financial_request_status_new AS ENUM (
  'draft',              -- Borrador
  'pending_specialist', -- Enviado a especialista, esperando aceptación
  'pending_approval',   -- Especialista aceptó, esperando aprobación AM/PM
  'in_progress',        -- En progreso (trabajo en curso)
  'pending_review',     -- Especialista terminó, pendiente revisión AM/PM
  'completed',          -- Completado y aprobado (listo para facturar/liquidar)
  'cancelled'           -- Cancelado
);

-- 2. Add temporary column with new type
ALTER TABLE public.financial_requests 
  ADD COLUMN status_new public.financial_request_status_new;

-- 3. Migrate existing data
UPDATE public.financial_requests 
SET status_new = CASE 
  WHEN status::text = 'draft' THEN 'draft'::public.financial_request_status_new
  WHEN status::text = 'active' THEN 'in_progress'::public.financial_request_status_new
  WHEN status::text = 'invoiced' THEN 'completed'::public.financial_request_status_new
  WHEN status::text = 'liquidated' THEN 'completed'::public.financial_request_status_new
  ELSE 'draft'::public.financial_request_status_new
END;

-- 4. Drop old column and rename new one
ALTER TABLE public.financial_requests DROP COLUMN status;
ALTER TABLE public.financial_requests RENAME COLUMN status_new TO status;

-- 5. Set default and not null
ALTER TABLE public.financial_requests 
  ALTER COLUMN status SET DEFAULT 'draft'::public.financial_request_status_new,
  ALTER COLUMN status SET NOT NULL;

-- 6. Drop old enum type
DROP TYPE public.financial_request_status;

-- 7. Rename new enum to final name
ALTER TYPE public.financial_request_status_new RENAME TO financial_request_status;