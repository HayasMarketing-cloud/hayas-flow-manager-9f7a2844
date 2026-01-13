
-- =====================================================
-- Ampliar permisos de Account Manager
-- Permitir ver todo lo relacionado con sus clientes asignados
-- =====================================================

-- 1. Presupuestos - AM puede ver presupuestos de sus clientes
CREATE POLICY "Account managers can view budgets from assigned clients"
ON public.budgets FOR SELECT
USING (
  client_id IN (
    SELECT client_id FROM public.contracts WHERE am_user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
);

-- 2. Facturas - AM puede ver facturas de sus clientes
CREATE POLICY "Account managers can view invoices from assigned clients"
ON public.invoices FOR SELECT
USING (
  client_id IN (
    SELECT client_id FROM public.contracts WHERE am_user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
);

-- 3. Proyectos Operacionales - AM puede ver proyectos de sus clientes
CREATE POLICY "Account managers can view projects from assigned clients"
ON public.operational_projects FOR SELECT
USING (
  client_id IN (
    SELECT client_id FROM public.contracts WHERE am_user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'project_manager'::app_role)
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
);

-- 4. Solicitudes Operacionales - AM puede ver actividades de sus clientes
CREATE POLICY "Account managers can view operational requests from assigned clients"
ON public.operational_requests FOR SELECT
USING (
  client_id IN (
    SELECT client_id FROM public.contracts WHERE am_user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'project_manager'::app_role)
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
);

-- 5. Hitos - AM puede ver hitos de proyectos de sus clientes
CREATE POLICY "Account managers can view milestones from assigned clients"
ON public.milestones FOR SELECT
USING (
  operational_request_id IN (
    SELECT id FROM public.operational_requests WHERE client_id IN (
      SELECT client_id FROM public.contracts WHERE am_user_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'project_manager'::app_role)
);

-- 6. Tareas - AM puede ver tareas de hitos de sus clientes
CREATE POLICY "Account managers can view tasks from assigned clients"
ON public.tasks FOR SELECT
USING (
  milestone_id IN (
    SELECT m.id FROM public.milestones m
    JOIN public.operational_requests r ON m.operational_request_id = r.id
    WHERE r.client_id IN (
      SELECT client_id FROM public.contracts WHERE am_user_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'project_manager'::app_role)
);

-- 7. Liquidaciones - AM puede ver liquidaciones de especialistas asignados a solicitudes de sus clientes
CREATE POLICY "Account managers can view liquidations from assigned clients"
ON public.liquidations FOR SELECT
USING (
  specialist_id IN (
    SELECT DISTINCT specialist_id FROM public.financial_requests 
    WHERE specialist_id IS NOT NULL
    AND client_id IN (
      SELECT client_id FROM public.contracts WHERE am_user_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
);

-- 8. Items de Liquidación - AM puede ver items de liquidaciones visibles
CREATE POLICY "Account managers can view liquidation items from assigned clients"
ON public.liquidation_items FOR SELECT
USING (
  liquidation_id IN (
    SELECT id FROM public.liquidations WHERE specialist_id IN (
      SELECT DISTINCT specialist_id FROM public.financial_requests 
      WHERE specialist_id IS NOT NULL
      AND client_id IN (
        SELECT client_id FROM public.contracts WHERE am_user_id = auth.uid()
      )
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
);
