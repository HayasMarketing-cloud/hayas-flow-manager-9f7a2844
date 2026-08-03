-- Remove duplicate trigger (same function attached twice)
DROP TRIGGER IF EXISTS prevent_invitation_role_escalation ON public.user_invitations;

-- Ensure the escalation guard exists and also covers accepted_at/status abuse
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_invitation_role_self_escalation ON public.user_invitations;
CREATE TRIGGER trg_prevent_invitation_role_self_escalation
BEFORE UPDATE ON public.user_invitations
FOR EACH ROW EXECUTE FUNCTION public.prevent_invitation_role_self_escalation();

-- Tighten the self-accept policy: only a pending, non-expired invitation may be
-- moved to 'accepted' by its own invitee
DROP POLICY IF EXISTS "Users can accept their own invitation" ON public.user_invitations;
CREATE POLICY "Users can accept their own invitation"
ON public.user_invitations
FOR UPDATE
TO authenticated
USING (
  email = auth.email()
  AND status = 'pending'
  AND expires_at > now()
)
WITH CHECK (
  email = auth.email()
  AND status = 'accepted'
);