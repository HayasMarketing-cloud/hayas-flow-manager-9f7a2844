
CREATE OR REPLACE FUNCTION public.prevent_invitation_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.roles IS DISTINCT FROM OLD.roles
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.invited_by IS DISTINCT FROM OLD.invited_by THEN
    RAISE EXCEPTION 'Only admins can modify invitation roles, email, expiration, or inviter';
  END IF;

  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "Users can accept their own invitation" ON public.user_invitations;

CREATE POLICY "Users can accept their own invitation"
ON public.user_invitations
FOR UPDATE
TO authenticated
USING (email = auth.email() AND status = 'pending')
WITH CHECK (
  email = auth.email()
  AND status IN ('pending','accepted')
);
