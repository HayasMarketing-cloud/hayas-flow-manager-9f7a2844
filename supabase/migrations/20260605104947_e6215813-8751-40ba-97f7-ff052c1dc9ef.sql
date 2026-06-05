
-- INVOICE FILES: restrict SELECT to users who can access the underlying invoice
DROP POLICY IF EXISTS "Authenticated users can view invoice files" ON storage.objects;

CREATE POLICY "Users can view invoice files they have access to"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoice-files'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id::text = split_part(storage.objects.name, '/', 1)
        AND i.client_id IN (
          SELECT contracts.client_id FROM public.contracts WHERE contracts.am_user_id = auth.uid()
          UNION
          SELECT budgets.client_id FROM public.budgets WHERE budgets.am_user_id = auth.uid()
        )
    )
  )
);

-- LIQUIDATION INVOICES: restrict SELECT to owner specialist / team leader / admin / finance
DROP POLICY IF EXISTS "Authenticated users can view liquidation invoices" ON storage.objects;

CREATE POLICY "Users can view liquidation invoice files they own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'liquidation-invoices'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.liquidations l
      JOIN public.specialists s ON s.id = l.specialist_id
      WHERE l.id::text = split_part(storage.objects.name, '/', 1)
        AND (
          s.user_id = auth.uid()
          OR s.team_leader_id = public.get_current_specialist_id()
        )
    )
  )
);
