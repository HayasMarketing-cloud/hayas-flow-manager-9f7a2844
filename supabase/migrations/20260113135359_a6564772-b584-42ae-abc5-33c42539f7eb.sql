-- 1. Clean up existing user_roles with obsolete roles
DELETE FROM public.user_roles WHERE role IN ('user', 'moderator');

-- 2. Update user_invitations to remove obsolete roles from arrays
UPDATE public.user_invitations 
SET roles = array_remove(array_remove(roles, 'user'), 'moderator')
WHERE 'user' = ANY(roles) OR 'moderator' = ANY(roles);

-- 3. Add RLS policy for Account Manager to view their assigned contracts
CREATE POLICY "Account managers can view assigned contracts"
ON public.contracts
FOR SELECT
USING (
  am_user_id = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR created_by = auth.uid()
);

-- 4. Add RLS policy for Account Manager to view clients from their contracts
CREATE POLICY "Account managers can view clients from assigned contracts"
ON public.clients
FOR SELECT
USING (
  id IN (
    SELECT client_id FROM public.contracts WHERE am_user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR created_by = auth.uid()
);

-- 5. Add RLS policy for Account Manager to view requests from their clients
CREATE POLICY "Account managers can view requests from assigned clients"
ON public.financial_requests
FOR SELECT
USING (
  client_id IN (
    SELECT client_id FROM public.contracts WHERE am_user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

-- 6. Add RLS policy for Seller to view invoices from their clients
CREATE POLICY "Sellers can view invoices from their clients"
ON public.invoices
FOR SELECT
USING (
  client_id IN (
    SELECT client_id FROM public.contracts WHERE seller_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

-- 7. Add RLS policy for Seller to view and create budgets
CREATE POLICY "Sellers can create budgets"
ON public.budgets
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'seller'::app_role) 
  AND auth.uid() = created_by
);

CREATE POLICY "Sellers can view own budgets"
ON public.budgets
FOR SELECT
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

-- 8. Add RLS policy for Seller to view clients from their contracts
CREATE POLICY "Sellers can view clients from their contracts"
ON public.clients
FOR SELECT
USING (
  id IN (
    SELECT client_id FROM public.contracts WHERE seller_id = auth.uid()
  )
  OR created_by = auth.uid()
);