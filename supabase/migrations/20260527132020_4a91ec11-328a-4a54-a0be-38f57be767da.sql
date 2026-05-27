
DROP POLICY IF EXISTS "Los usuarios autenticados pueden ver presupuestos" ON public.budgets;
DROP POLICY IF EXISTS "Users can view budget items" ON public.budget_items;

DROP POLICY IF EXISTS "Los usuarios autenticados pueden ver contratos" ON public.contracts;
DROP POLICY IF EXISTS "Account managers can view assigned contracts" ON public.contracts;
CREATE POLICY "Scoped contracts view"
ON public.contracts FOR SELECT TO authenticated
USING (
  am_user_id = auth.uid()
  OR pm_user_id = auth.uid()
  OR created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can view contract services" ON public.contract_services;
DROP POLICY IF EXISTS "Los usuarios autenticados pueden ver clientes" ON public.clients;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver contactos" ON public.client_contacts;
CREATE POLICY "Scoped client_contacts view"
ON public.client_contacts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR has_role(auth.uid(), 'account_manager'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
  OR client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid())
  OR client_id IN (
    SELECT DISTINCT fr.client_id FROM public.financial_requests fr
    WHERE fr.specialist_id IN (SELECT s.id FROM public.specialists s WHERE s.user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Los usuarios autenticados pueden ver especialistas" ON public.specialists;
CREATE POLICY "Scoped specialists view"
ON public.specialists FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR has_role(auth.uid(), 'account_manager'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
  OR has_role(auth.uid(), 'seller'::app_role)
  OR user_id = auth.uid()
  OR team_leader_id = public.get_current_specialist_id()
);

DROP POLICY IF EXISTS "Users can view items of invoices they can access" ON public.invoice_items;
CREATE POLICY "Users can view items of invoices they can access"
ON public.invoice_items FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
      AND (
        i.client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid())
        OR i.client_id IN (SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid())
        OR i.client_id IN (SELECT b.client_id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Specialists can insert own liquidation invoices" ON public.liquidation_invoices;
CREATE POLICY "Specialists can insert own liquidation invoices"
ON public.liquidation_invoices FOR INSERT TO authenticated
WITH CHECK (
  liquidation_id IN (
    SELECT l.id FROM public.liquidations l
    JOIN public.specialists s ON l.specialist_id = s.id
    WHERE s.user_id = auth.uid()
      AND l.status IN ('draft','sent','pending_payment','invoice_received')
  )
);

DROP POLICY IF EXISTS "Specialists can delete own liquidation invoices" ON public.liquidation_invoices;
CREATE POLICY "Specialists can delete own liquidation invoices"
ON public.liquidation_invoices FOR DELETE TO authenticated
USING (
  liquidation_id IN (
    SELECT l.id FROM public.liquidations l
    JOIN public.specialists s ON l.specialist_id = s.id
    WHERE s.user_id = auth.uid()
      AND l.status IN ('draft','sent','pending_payment','invoice_received')
  )
);

DROP POLICY IF EXISTS "Users can insert own roles from invitation" ON public.user_roles;
CREATE POLICY "Users can insert own roles from invitation"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_invitations ui
    WHERE ui.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())::text
      AND ui.status IN ('pending','accepted')
      AND user_roles.role = ANY (ui.roles)
  )
);
