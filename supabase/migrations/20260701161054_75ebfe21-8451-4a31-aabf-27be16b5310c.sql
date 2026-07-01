
-- 1) Security definer view -> switch to security invoker
ALTER VIEW public.specialist_my_requests SET (security_invoker = true);

-- 2) clients: drop overly broad policy
DROP POLICY IF EXISTS "Specialists can view their clients" ON public.clients;

CREATE POLICY "Specialists can view their assigned clients"
ON public.clients
FOR SELECT
USING (
  id IN (
    SELECT DISTINCT fr.client_id
    FROM public.financial_requests fr
    WHERE fr.specialist_id IN (
      SELECT s.id FROM public.specialists s WHERE s.user_id = auth.uid()
    )
  )
);

-- 3) closed_months: remove blanket AM/PM view access (admin/finanzas already covered by ALL policy)
DROP POLICY IF EXISTS "Management roles can view closed_months" ON public.closed_months;

-- 4) operational_projects: remove blanket account_manager access from specialist policy
DROP POLICY IF EXISTS "Specialists can view projects with assigned requests" ON public.operational_projects;

CREATE POLICY "Specialists can view projects with assigned requests"
ON public.operational_projects
FOR SELECT
USING (
  id IN (
    SELECT DISTINCT orq.operational_project_id
    FROM public.operational_requests orq
    WHERE orq.assignee_specialist_id IN (
      SELECT s.id FROM public.specialists s WHERE s.user_id = auth.uid()
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

-- 5) user_invitations: prevent self role escalation via trigger
CREATE OR REPLACE FUNCTION public.prevent_invitation_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins may change anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Non-admins cannot change roles, email, or expires_at on their own invitation
  IF NEW.roles IS DISTINCT FROM OLD.roles
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'Only admins can modify invitation roles, email, or expiration';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_invitation_role_escalation ON public.user_invitations;
CREATE TRIGGER prevent_invitation_role_escalation
BEFORE UPDATE ON public.user_invitations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_invitation_role_self_escalation();
