-- Fix MISSING_RLS: scope budget_share_tokens SELECT to users who can see the budget
DROP POLICY IF EXISTS "Authenticated users can view share tokens" ON public.budget_share_tokens;

CREATE POLICY "Users can view share tokens for visible budgets"
ON public.budget_share_tokens
FOR SELECT
TO authenticated
USING (
  budget_id IN (
    SELECT b.id FROM public.budgets b
    WHERE b.am_user_id = auth.uid()
       OR b.pm_user_id = auth.uid()
       OR b.created_by = auth.uid()
       OR b.client_id IN (SELECT ca.client_id FROM public.client_assignments ca WHERE ca.user_id = auth.uid())
       OR b.client_id IN (SELECT c.client_id FROM public.contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
);

-- Fix PRIVILEGE_ESCALATION: tighten user_roles insert from invitation
DROP POLICY IF EXISTS "Users can insert own roles from invitation" ON public.user_roles;

CREATE POLICY "Users can insert own roles from invitation"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_invitations ui
    WHERE ui.email = ((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))::text
      AND ui.status = 'pending'
      AND ui.expires_at > now()
      AND ui.accepted_at IS NULL
      AND user_roles.role = ANY (ui.roles)
  )
);