-- 1) Prevent specialists from editing their own financial / org fields
CREATE OR REPLACE FUNCTION public.prevent_specialist_financial_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'finanzas'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate
     OR NEW.active IS DISTINCT FROM OLD.active
     OR NEW.team_leader_id IS DISTINCT FROM OLD.team_leader_id
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Only admins or finance can change specialist rate, status, type, email, team leader or owner';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_specialist_financial_self_update ON public.specialists;
CREATE TRIGGER trg_prevent_specialist_financial_self_update
BEFORE UPDATE ON public.specialists
FOR EACH ROW EXECUTE FUNCTION public.prevent_specialist_financial_self_update();

-- 2) Harden invitation acceptance: no role/email/inviter/expiry changes by invitee
CREATE OR REPLACE FUNCTION public.prevent_invitation_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.roles IS DISTINCT FROM OLD.roles
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.invited_by IS DISTINCT FROM OLD.invited_by
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only admins can modify invitation roles, email, expiration or inviter';
  END IF;

  -- Non-admins may only move a pending invitation to accepted
  IF OLD.status <> 'pending' OR NEW.status <> 'accepted' THEN
    RAISE EXCEPTION 'Invitees can only accept a pending invitation';
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Users can accept their own invitation" ON public.user_invitations;
CREATE POLICY "Users can accept their own invitation"
ON public.user_invitations
FOR UPDATE
TO authenticated
USING (email = auth.email() AND status = 'pending' AND expires_at > now())
WITH CHECK (email = auth.email() AND status = 'accepted');