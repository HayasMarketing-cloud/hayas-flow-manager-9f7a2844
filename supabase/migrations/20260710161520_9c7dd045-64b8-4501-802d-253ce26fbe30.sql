CREATE OR REPLACE FUNCTION public.can_view_liquidation_as_assigned_am(_liquidation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.liquidation_items li
    JOIN public.financial_requests fr ON fr.id = li.financial_request_id
    WHERE li.liquidation_id = _liquidation_id
      AND (
        fr.client_id IN (
          SELECT c.client_id
          FROM public.contracts c
          WHERE c.am_user_id = auth.uid()
          UNION
          SELECT b.client_id
          FROM public.budgets b
          WHERE b.am_user_id = auth.uid()
        )
        OR fr.budget_id IN (
          SELECT b.id
          FROM public.budgets b
          WHERE b.am_user_id = auth.uid()
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_leader_liquidation(_liquidation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.liquidations l
    JOIN public.specialists s ON l.specialist_id = s.id
    WHERE l.id = _liquidation_id
      AND s.team_leader_id = public.get_current_specialist_id()
  )
$$;

DROP POLICY IF EXISTS "AM can view liquidations from assigned clients or budgets" ON public.liquidations;
CREATE POLICY "AM can view liquidations from assigned clients or budgets"
ON public.liquidations
FOR SELECT
TO public
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
  OR public.can_view_liquidation_as_assigned_am(id)
);

DROP POLICY IF EXISTS "Users can view relevant liquidation items" ON public.liquidation_items;
CREATE POLICY "Users can view relevant liquidation items"
ON public.liquidation_items
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
  OR public.is_specialist_liquidation(liquidation_id)
);

DROP POLICY IF EXISTS "Team leaders can view team member liquidation items" ON public.liquidation_items;
CREATE POLICY "Team leaders can view team member liquidation items"
ON public.liquidation_items
FOR SELECT
TO public
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
  OR public.is_team_leader_liquidation(liquidation_id)
);