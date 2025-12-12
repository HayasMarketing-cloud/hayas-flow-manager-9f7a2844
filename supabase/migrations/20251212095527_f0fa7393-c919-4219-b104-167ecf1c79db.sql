-- Add specialist_id column to budget_items
ALTER TABLE public.budget_items
ADD COLUMN specialist_id uuid REFERENCES public.specialists(id) ON DELETE SET NULL;