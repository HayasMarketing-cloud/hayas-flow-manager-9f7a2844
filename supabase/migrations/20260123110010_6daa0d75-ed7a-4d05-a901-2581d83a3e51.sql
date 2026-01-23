-- Create storage bucket for invoice files
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-files', 'invoice-files', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for finance and admin to upload invoice files
CREATE POLICY "Finance and admin can upload invoice files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-files'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finanzas'))
);

-- Policy for finance and admin to update invoice files
CREATE POLICY "Finance and admin can update invoice files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'invoice-files'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finanzas'))
);

-- Policy for finance and admin to delete invoice files
CREATE POLICY "Finance and admin can delete invoice files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoice-files'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finanzas'))
);

-- Policy for authenticated users to view invoice files
CREATE POLICY "Authenticated users can view invoice files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'invoice-files');

-- Add pdf_url column to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Add sent_at and paid_at columns for tracking state changes
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;