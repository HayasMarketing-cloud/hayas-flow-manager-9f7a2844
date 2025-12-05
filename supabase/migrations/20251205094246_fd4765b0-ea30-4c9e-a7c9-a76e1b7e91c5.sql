-- Añadir columna para enlazar el documento de presupuesto aceptado por el cliente
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS accepted_document_url text;