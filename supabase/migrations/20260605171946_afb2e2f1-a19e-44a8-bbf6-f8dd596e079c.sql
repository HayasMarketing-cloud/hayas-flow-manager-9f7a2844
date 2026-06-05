CREATE OR REPLACE FUNCTION public.is_specialist_on_contract(_contract_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contract_services cs
    JOIN public.specialists s ON s.id = cs.specialist_id
    WHERE cs.contract_id = _contract_id
      AND s.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.contracts c
    JOIN public.specialists s ON s.user_id = auth.uid()
    WHERE c.id = _contract_id
      AND c.specialists_default IS NOT NULL
      AND s.id = ANY(c.specialists_default)
  )
$$;

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
  OR public.is_specialist_on_contract(id)
);