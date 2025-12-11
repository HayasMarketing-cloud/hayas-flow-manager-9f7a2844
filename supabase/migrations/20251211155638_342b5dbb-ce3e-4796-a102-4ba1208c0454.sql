-- Drop the existing constraint that requires quantity >= 1
ALTER TABLE public.financial_requests DROP CONSTRAINT requests_quantity_check;

-- Add a new constraint that allows decimal quantities > 0
ALTER TABLE public.financial_requests ADD CONSTRAINT requests_quantity_check CHECK (quantity > 0);