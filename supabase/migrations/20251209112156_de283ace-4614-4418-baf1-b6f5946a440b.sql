-- Change quantity column from integer to numeric to allow decimals
ALTER TABLE public.financial_requests 
ALTER COLUMN quantity TYPE numeric USING quantity::numeric;