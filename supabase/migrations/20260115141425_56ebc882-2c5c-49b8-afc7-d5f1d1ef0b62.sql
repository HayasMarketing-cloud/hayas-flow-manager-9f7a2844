-- Add is_on_demand column to contracts table
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS is_on_demand BOOLEAN NOT NULL DEFAULT false;