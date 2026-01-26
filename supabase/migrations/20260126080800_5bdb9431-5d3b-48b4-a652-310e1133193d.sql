-- Añadir nuevo valor al enum liquidation_status
ALTER TYPE liquidation_status ADD VALUE 'invoice_received' AFTER 'accepted';

-- Añadir columna para URL de factura del especialista
ALTER TABLE liquidations ADD COLUMN specialist_invoice_url text;

-- Crear bucket de storage para facturas de especialistas
INSERT INTO storage.buckets (id, name, public)
VALUES ('liquidation-invoices', 'liquidation-invoices', true);

-- Política: Finance y admin pueden subir facturas
CREATE POLICY "Finance can upload liquidation invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'liquidation-invoices' 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

-- Política: Usuarios autenticados pueden ver facturas
CREATE POLICY "Authenticated users can view liquidation invoices"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'liquidation-invoices');

-- Política: Finance y admin pueden eliminar facturas
CREATE POLICY "Finance can delete liquidation invoices"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'liquidation-invoices' 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

-- Política: Finance y admin pueden actualizar facturas
CREATE POLICY "Finance can update liquidation invoices"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'liquidation-invoices' 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);