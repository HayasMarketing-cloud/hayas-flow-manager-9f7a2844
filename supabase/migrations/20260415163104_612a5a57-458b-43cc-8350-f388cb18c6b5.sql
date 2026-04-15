-- Add storage policies for expense-invoices bucket (upload, update, delete)

CREATE POLICY "Authenticated users can upload expense invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'expense-invoices');

CREATE POLICY "Authenticated users can update expense invoices"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'expense-invoices');

CREATE POLICY "Authenticated users can delete expense invoices"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'expense-invoices');