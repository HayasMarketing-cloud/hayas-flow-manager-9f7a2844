
DROP POLICY IF EXISTS "AM can view liquidations from assigned clients or budgets" ON public.liquidations;
DROP POLICY IF EXISTS "AM can view liquidation items from assigned clients or budgets" ON public.liquidation_items;

CREATE POLICY "AM can view liquidations from assigned clients or budgets"
ON public.liquidations
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.liquidation_items li
    JOIN public.financial_requests fr ON fr.id = li.financial_request_id
    WHERE li.liquidation_id = liquidations.id
      AND (
        fr.client_id IN (
          SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid()
          UNION
          SELECT b.client_id FROM public.budgets b WHERE b.am_user_id = auth.uid()
        )
        OR fr.budget_id IN (
          SELECT b.id FROM public.budgets b WHERE b.am_user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "AM can view liquidation items from assigned clients or budgets"
ON public.liquidation_items
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.financial_requests fr
    WHERE fr.id = liquidation_items.financial_request_id
      AND (
        fr.client_id IN (
          SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid()
          UNION
          SELECT b.client_id FROM public.budgets b WHERE b.am_user_id = auth.uid()
        )
        OR fr.budget_id IN (
          SELECT b.id FROM public.budgets b WHERE b.am_user_id = auth.uid()
        )
      )
  )
);
