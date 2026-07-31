-- 1) services: restrict reads to users that actually have a role in the app
DROP POLICY IF EXISTS "Los usuarios autenticados pueden ver servicios" ON public.services;

CREATE POLICY "Usuarios con rol pueden ver servicios"
ON public.services
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

-- 2) user_invitations: prevent self role escalation
DROP POLICY IF EXISTS "Users can accept their own invitation" ON public.user_invitations;

CREATE POLICY "Users can accept their own invitation"
ON public.user_invitations
FOR UPDATE
TO authenticated
USING (email = auth.email() AND status = 'pending')
WITH CHECK (email = auth.email() AND status = ANY (ARRAY['pending','accepted']));

DROP TRIGGER IF EXISTS trg_prevent_invitation_role_self_escalation ON public.user_invitations;
CREATE TRIGGER trg_prevent_invitation_role_self_escalation
BEFORE UPDATE ON public.user_invitations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_invitation_role_self_escalation();