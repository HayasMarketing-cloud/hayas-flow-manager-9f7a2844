
-- 1. Fix expense-invoices bucket: make private, drop overly-permissive policies
UPDATE storage.buckets SET public = false WHERE id = 'expense-invoices';

DROP POLICY IF EXISTS "Authenticated users can upload expense invoices" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update expense invoices" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete expense invoices" ON storage.objects;
DROP POLICY IF EXISTS "Expense invoices are publicly readable" ON storage.objects;

-- 2. Add SELECT policy for invoice_items so users who can view the parent invoice can view items
CREATE POLICY "Users can view items of invoices they can access"
ON public.invoice_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
  )
);
