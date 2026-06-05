DROP POLICY IF EXISTS "Scoped contracts view" ON public.contracts;

CREATE POLICY "Scoped contracts view" ON public.contracts
FOR SELECT
USING (
  am_user_id = auth.uid()
  OR pm_user_id = auth.uid()
  OR created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR client_id IN (SELECT ca.client_id FROM client_assignments ca WHERE ca.user_id = auth.uid())
  OR id IN (
    SELECT cs.contract_id FROM contract_services cs
    JOIN specialists s ON s.id = cs.specialist_id
    WHERE s.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM specialists s
    WHERE s.user_id = auth.uid()
      AND contracts.specialists_default IS NOT NULL
      AND s.id = ANY(contracts.specialists_default)
  )
);