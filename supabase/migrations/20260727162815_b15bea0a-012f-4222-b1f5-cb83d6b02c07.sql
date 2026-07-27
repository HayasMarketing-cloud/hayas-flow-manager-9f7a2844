
CREATE OR REPLACE FUNCTION public.can_view_specialist(_specialist_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Elevated roles: full access
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
    -- Self access
    OR EXISTS (
      SELECT 1 FROM public.specialists s
      WHERE s.id = _specialist_id
        AND (
          s.user_id = auth.uid()
          OR s.created_by = auth.uid()
          OR s.team_leader_id = public.get_current_specialist_id()
        )
    )
    -- AM/PM/Seller: only via linkage to assigned clients/contracts/budgets
    OR (
      (
        public.has_role(auth.uid(), 'account_manager'::app_role)
        OR public.has_role(auth.uid(), 'project_manager'::app_role)
        OR public.has_role(auth.uid(), 'seller'::app_role)
      )
      AND (
        EXISTS (
          SELECT 1 FROM public.contract_services cs
          JOIN public.contracts c ON c.id = cs.contract_id
          WHERE cs.specialist_id = _specialist_id
            AND (
              c.am_user_id = auth.uid()
              OR c.pm_user_id = auth.uid()
              OR c.seller_id = auth.uid()
              OR c.created_by = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.client_assignments ca
                WHERE ca.client_id = c.client_id AND ca.user_id = auth.uid()
              )
            )
        )
        OR EXISTS (
          SELECT 1 FROM public.budget_items bi
          JOIN public.budgets b ON b.id = bi.budget_id
          WHERE bi.specialist_id = _specialist_id
            AND (
              b.am_user_id = auth.uid()
              OR b.pm_user_id = auth.uid()
              OR b.created_by = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.client_assignments ca
                WHERE ca.client_id = b.client_id AND ca.user_id = auth.uid()
              )
            )
        )
        OR EXISTS (
          SELECT 1 FROM public.financial_requests fr
          WHERE fr.specialist_id = _specialist_id
            AND EXISTS (
              SELECT 1 FROM public.client_assignments ca
              WHERE ca.client_id = fr.client_id AND ca.user_id = auth.uid()
            )
        )
      )
    )
$$;

DROP POLICY IF EXISTS "Scoped specialists view" ON public.specialists;

CREATE POLICY "Scoped specialists view"
ON public.specialists
FOR SELECT
TO authenticated
USING (public.can_view_specialist(id));
