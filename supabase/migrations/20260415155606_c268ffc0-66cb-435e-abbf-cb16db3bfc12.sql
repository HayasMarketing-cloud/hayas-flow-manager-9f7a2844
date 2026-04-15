UPDATE storage.buckets SET public = true WHERE id = 'expense-invoices';

CREATE POLICY "Expense invoices are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'expense-invoices');
