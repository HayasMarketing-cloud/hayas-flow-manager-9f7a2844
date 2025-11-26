-- Fase 1: Eliminar price de services y agregar valores a billing_frequency

-- Eliminar columna price de services
ALTER TABLE public.services DROP COLUMN IF EXISTS price;

-- Agregar nuevos valores al enum billing_frequency
ALTER TYPE public.billing_frequency ADD VALUE IF NOT EXISTS 'per_project';
ALTER TYPE public.billing_frequency ADD VALUE IF NOT EXISTS 'on_demand';