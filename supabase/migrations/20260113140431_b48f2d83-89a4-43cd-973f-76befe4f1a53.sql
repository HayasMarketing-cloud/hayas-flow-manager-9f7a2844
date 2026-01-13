-- ===========================================
-- Specialist Permissions: Complete Access
-- ===========================================

-- 1. Specialists can view clients they have worked with
CREATE POLICY "Specialists can view their clients"
ON public.clients FOR SELECT
USING (
  id IN (
    SELECT DISTINCT client_id FROM public.financial_requests 
    WHERE specialist_id IN (
      SELECT id FROM public.specialists WHERE user_id = auth.uid()
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
  OR has_role(auth.uid(), 'account_manager'::app_role)
  OR has_role(auth.uid(), 'seller'::app_role)
);

-- 2. Specialists can view operational projects where they have assigned activities
CREATE POLICY "Specialists can view projects with assigned requests"
ON public.operational_projects FOR SELECT
USING (
  id IN (
    SELECT DISTINCT operational_project_id FROM public.operational_requests
    WHERE assignee_specialist_id IN (
      SELECT id FROM public.specialists WHERE user_id = auth.uid()
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR has_role(auth.uid(), 'account_manager'::app_role)
);