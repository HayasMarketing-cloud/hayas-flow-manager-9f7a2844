
-- Helper: is the user assigned to this client (directly, or via contract/budget AM/PM)?
CREATE OR REPLACE FUNCTION public.is_assigned_to_client(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_assignments ca
    WHERE ca.user_id = auth.uid() AND ca.client_id = _client_id
  ) OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.client_id = _client_id
      AND (c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.client_id = _client_id
      AND (b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_to_budget(_budget_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _budget_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = _budget_id
      AND (b.am_user_id = auth.uid() OR b.pm_user_id = auth.uid())
  );
$$;

-- ============ financial_requests ============
DROP POLICY IF EXISTS "Finance roles can manage financial_requests" ON public.financial_requests;
DROP POLICY IF EXISTS "Specialists liquidation context can view own requests" ON public.financial_requests;
DROP POLICY IF EXISTS "AM and PM can create requests for assigned clients or budgets" ON public.financial_requests;
DROP POLICY IF EXISTS "AM and PM can update requests for assigned clients or budgets" ON public.financial_requests;
DROP POLICY IF EXISTS "Account managers can view requests from assigned clients or bud" ON public.financial_requests;

CREATE POLICY "Finance roles can manage financial_requests"
ON public.financial_requests FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role));

CREATE POLICY "AM and PM can view requests for assigned clients or budgets"
ON public.financial_requests FOR SELECT TO authenticated
USING (
  public.is_assigned_to_client(client_id)
  OR public.is_assigned_to_budget(budget_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

CREATE POLICY "AM and PM can create requests for assigned clients or budgets"
ON public.financial_requests FOR INSERT TO authenticated
WITH CHECK (
  public.is_assigned_to_client(client_id)
  OR public.is_assigned_to_budget(budget_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

CREATE POLICY "AM and PM can update requests for assigned clients or budgets"
ON public.financial_requests FOR UPDATE TO authenticated
USING (
  public.is_assigned_to_client(client_id)
  OR public.is_assigned_to_budget(budget_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
)
WITH CHECK (
  public.is_assigned_to_client(client_id)
  OR public.is_assigned_to_budget(budget_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

-- ============ operational_projects ============
DROP POLICY IF EXISTS "PM and admin can manage projects" ON public.operational_projects;
DROP POLICY IF EXISTS "AM and PM can view projects from assigned clients or budgets" ON public.operational_projects;
DROP POLICY IF EXISTS "AM and PM can create projects for assigned clients" ON public.operational_projects;
DROP POLICY IF EXISTS "AM and PM can update projects for assigned clients" ON public.operational_projects;
DROP POLICY IF EXISTS "AM and PM can delete projects for assigned clients" ON public.operational_projects;
DROP POLICY IF EXISTS "Users can view assigned projects" ON public.operational_projects;
DROP POLICY IF EXISTS "Specialists can view projects with assigned requests" ON public.operational_projects;

CREATE POLICY "Admins and finance can manage projects"
ON public.operational_projects FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "AM and PM can view projects from assigned clients or budgets"
ON public.operational_projects FOR SELECT TO authenticated
USING (
  public.is_assigned_to_client(client_id)
  OR public.is_assigned_to_budget(budget_id)
  OR owner_user_id = auth.uid()
  OR created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

CREATE POLICY "AM and PM can create projects for assigned clients"
ON public.operational_projects FOR INSERT TO authenticated
WITH CHECK (
  public.is_assigned_to_client(client_id)
  OR public.is_assigned_to_budget(budget_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "AM and PM can update projects for assigned clients"
ON public.operational_projects FOR UPDATE TO authenticated
USING (
  public.is_assigned_to_client(client_id)
  OR public.is_assigned_to_budget(budget_id)
  OR owner_user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.is_assigned_to_client(client_id)
  OR public.is_assigned_to_budget(budget_id)
  OR owner_user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "AM and PM can delete projects for assigned clients"
ON public.operational_projects FOR DELETE TO authenticated
USING (
  public.is_assigned_to_client(client_id)
  OR public.is_assigned_to_budget(budget_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Specialists can view projects with assigned requests"
ON public.operational_projects FOR SELECT TO authenticated
USING (
  id IN (
    SELECT orq.operational_project_id FROM public.operational_requests orq
    WHERE orq.assignee_specialist_id IN (
      SELECT s.id FROM public.specialists s WHERE s.user_id = auth.uid()
    )
    OR orq.assignee_user_id = auth.uid()
  )
);

-- ============ operational_requests ============
DROP POLICY IF EXISTS "PM and admin can manage requests" ON public.operational_requests;
DROP POLICY IF EXISTS "AM and PM can view operational requests from assigned clients" ON public.operational_requests;
DROP POLICY IF EXISTS "AM and PM can create operational requests for assigned clients" ON public.operational_requests;
DROP POLICY IF EXISTS "AM and PM can update operational requests for assigned clients" ON public.operational_requests;
DROP POLICY IF EXISTS "AM and PM can delete operational requests for assigned clients" ON public.operational_requests;
DROP POLICY IF EXISTS "Users can view assigned requests" ON public.operational_requests;

CREATE POLICY "Admins can manage operational requests"
ON public.operational_requests FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "AM and PM can view operational requests from assigned clients"
ON public.operational_requests FOR SELECT TO authenticated
USING (
  public.is_assigned_to_client(client_id)
  OR created_by = auth.uid()
  OR assignee_user_id = auth.uid()
  OR assignee_specialist_id IN (
    SELECT s.id FROM public.specialists s WHERE s.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

CREATE POLICY "AM and PM can create operational requests for assigned clients"
ON public.operational_requests FOR INSERT TO authenticated
WITH CHECK (
  public.is_assigned_to_client(client_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "AM and PM can update operational requests for assigned clients"
ON public.operational_requests FOR UPDATE TO authenticated
USING (
  public.is_assigned_to_client(client_id)
  OR assignee_user_id = auth.uid()
  OR assignee_specialist_id IN (
    SELECT s.id FROM public.specialists s WHERE s.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.is_assigned_to_client(client_id)
  OR assignee_user_id = auth.uid()
  OR assignee_specialist_id IN (
    SELECT s.id FROM public.specialists s WHERE s.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "AM and PM can delete operational requests for assigned clients"
ON public.operational_requests FOR DELETE TO authenticated
USING (
  public.is_assigned_to_client(client_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);
