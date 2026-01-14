-- Add hourly_rate column to specialists table
-- This stores the standard hourly rate for each specialist (updated annually)
ALTER TABLE public.specialists 
  ADD COLUMN hourly_rate numeric DEFAULT 0;

COMMENT ON COLUMN public.specialists.hourly_rate IS 
  'Tarifa estándar por hora del especialista (se actualiza anualmente)';