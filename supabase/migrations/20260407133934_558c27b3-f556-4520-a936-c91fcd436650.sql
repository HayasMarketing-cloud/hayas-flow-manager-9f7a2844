
-- Create client_assignments table for client-level AM/PM access
CREATE TABLE public.client_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('am', 'pm')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id, role)
);

ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and finance can manage client_assignments"
  ON public.client_assignments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role));

CREATE POLICY "Authenticated users can view client_assignments"
  ON public.client_assignments FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Update budgets INSERT policy to include client_assignments
DROP POLICY IF EXISTS "AM and PM can create budgets for assigned clients" ON public.budgets;
CREATE POLICY "AM and PM can create budgets for assigned clients"
  ON public.budgets FOR INSERT
  WITH CHECK (
    (client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid()))
    OR (client_id IN (SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid()))
    OR am_user_id = auth.uid()
    OR pm_user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
    OR auth.uid() = created_by
  );

-- Update budgets SELECT policy to include client_assignments
DROP POLICY IF EXISTS "AM and PM can view assigned budgets" ON public.budgets;
CREATE POLICY "AM and PM can view assigned budgets"
  ON public.budgets FOR SELECT
  USING (
    am_user_id = auth.uid()
    OR pm_user_id = auth.uid()
    OR (client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid()))
    OR (client_id IN (SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  );

-- Update budgets UPDATE policy to include client_assignments
DROP POLICY IF EXISTS "AM and PM can update assigned budgets" ON public.budgets;
CREATE POLICY "AM and PM can update assigned budgets"
  ON public.budgets FOR UPDATE
  USING (
    am_user_id = auth.uid()
    OR pm_user_id = auth.uid()
    OR (client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid()))
    OR (client_id IN (SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  );

-- Update clients SELECT to include client_assignments
DROP POLICY IF EXISTS "Account managers can view clients from assigned contracts or bu" ON public.clients;
CREATE POLICY "Account managers can view clients from assignments or contracts"
  ON public.clients FOR SELECT
  USING (
    (id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid()))
    OR (id IN (
      SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid()
      UNION
      SELECT b.client_id FROM public.budgets b WHERE b.am_user_id = auth.uid()
    ))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
    OR created_by = auth.uid()
  );

-- Update financial_requests INSERT to include client_assignments
DROP POLICY IF EXISTS "AM and PM can create requests for assigned clients or budgets" ON public.financial_requests;
CREATE POLICY "AM and PM can create requests for assigned clients or budgets"
  ON public.financial_requests FOR INSERT
  WITH CHECK (
    (client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid()))
    OR (client_id IN (SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid()))
    OR (client_id IN (SELECT b.client_id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()))
    OR (budget_id IN (SELECT b.id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
    OR has_role(auth.uid(), 'project_manager'::app_role)
  );

-- Update financial_requests UPDATE to include client_assignments
DROP POLICY IF EXISTS "AM and PM can update requests for assigned clients or budgets" ON public.financial_requests;
CREATE POLICY "AM and PM can update requests for assigned clients or budgets"
  ON public.financial_requests FOR UPDATE
  USING (
    (client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid()))
    OR (client_id IN (SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid()))
    OR (client_id IN (SELECT b.client_id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()))
    OR (budget_id IN (SELECT b.id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
    OR has_role(auth.uid(), 'project_manager'::app_role)
  );

-- Update financial_requests SELECT to include client_assignments
DROP POLICY IF EXISTS "Account managers can view requests from assigned clients or bud" ON public.financial_requests;
CREATE POLICY "Account managers can view requests from assigned clients or budgets"
  ON public.financial_requests FOR SELECT
  USING (
    (client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid()))
    OR (client_id IN (
      SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid()
      UNION
      SELECT b.client_id FROM public.budgets b WHERE b.am_user_id = auth.uid()
    ))
    OR (budget_id IN (SELECT b.id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
    OR has_role(auth.uid(), 'project_manager'::app_role)
  );

-- Update operational_projects policies to include client_assignments
DROP POLICY IF EXISTS "AM and PM can view projects from assigned clients or budgets" ON public.operational_projects;
CREATE POLICY "AM and PM can view projects from assigned clients or budgets"
  ON public.operational_projects FOR SELECT
  USING (
    (client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid()))
    OR (client_id IN (
      SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid()
      UNION
      SELECT b.client_id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()
    ))
    OR (budget_id IN (SELECT b.id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'project_manager'::app_role)
    OR has_role(auth.uid(), 'finanzas'::app_role)
  );

DROP POLICY IF EXISTS "AM and PM can create projects for assigned clients" ON public.operational_projects;
CREATE POLICY "AM and PM can create projects for assigned clients"
  ON public.operational_projects FOR INSERT
  WITH CHECK (
    (client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid()))
    OR (client_id IN (SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid()))
    OR (client_id IN (SELECT b.client_id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()))
    OR (budget_id IN (SELECT b.id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'project_manager'::app_role)
  );

DROP POLICY IF EXISTS "AM and PM can update projects for assigned clients" ON public.operational_projects;
CREATE POLICY "AM and PM can update projects for assigned clients"
  ON public.operational_projects FOR UPDATE
  USING (
    (client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid()))
    OR (client_id IN (SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid()))
    OR (client_id IN (SELECT b.client_id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()))
    OR (budget_id IN (SELECT b.id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'project_manager'::app_role)
  );

DROP POLICY IF EXISTS "AM and PM can delete projects for assigned clients" ON public.operational_projects;
CREATE POLICY "AM and PM can delete projects for assigned clients"
  ON public.operational_projects FOR DELETE
  USING (
    (client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid()))
    OR (client_id IN (SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid()))
    OR (client_id IN (SELECT b.client_id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()))
    OR (budget_id IN (SELECT b.id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'project_manager'::app_role)
  );

-- Update operational_requests policies to include client_assignments
DROP POLICY IF EXISTS "AM and PM can view operational requests from assigned clients o" ON public.operational_requests;
CREATE POLICY "AM and PM can view operational requests from assigned clients"
  ON public.operational_requests FOR SELECT
  USING (
    (client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid()))
    OR (client_id IN (
      SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid()
      UNION
      SELECT b.client_id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()
    ))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'project_manager'::app_role)
  );

DROP POLICY IF EXISTS "AM and PM can create operational requests for assigned clients" ON public.operational_requests;
CREATE POLICY "AM and PM can create operational requests for assigned clients"
  ON public.operational_requests FOR INSERT
  WITH CHECK (
    (client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid()))
    OR (client_id IN (SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid()))
    OR (client_id IN (SELECT b.client_id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'project_manager'::app_role)
  );

DROP POLICY IF EXISTS "AM and PM can update operational requests for assigned clients" ON public.operational_requests;
CREATE POLICY "AM and PM can update operational requests for assigned clients"
  ON public.operational_requests FOR UPDATE
  USING (
    (client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid()))
    OR (client_id IN (SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid()))
    OR (client_id IN (SELECT b.client_id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'project_manager'::app_role)
  );

DROP POLICY IF EXISTS "AM and PM can delete operational requests for assigned clients" ON public.operational_requests;
CREATE POLICY "AM and PM can delete operational requests for assigned clients"
  ON public.operational_requests FOR DELETE
  USING (
    (client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid()))
    OR (client_id IN (SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid()))
    OR (client_id IN (SELECT b.client_id FROM public.budgets b WHERE b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'project_manager'::app_role)
  );

-- Also revert Tomás' pm_user_id on the contract since it was only set for access
UPDATE public.contracts SET pm_user_id = NULL WHERE id = 'e8a987ab-df3e-4db3-aa6e-7e18a5deca75' AND pm_user_id = 'c3f5376d-dcc1-46bd-92ef-c5012db6e241';
