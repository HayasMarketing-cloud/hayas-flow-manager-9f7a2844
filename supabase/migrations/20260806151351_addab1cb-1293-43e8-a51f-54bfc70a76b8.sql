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
  -- Los campos sensibles deben coincidir exactamente con los de la fila original
  AND EXISTS (
    SELECT 1
    FROM public.user_invitations orig
    WHERE orig.id = user_invitations.id
      AND orig.roles = user_invitations.roles
      AND orig.email = user_invitations.email
      AND orig.invited_by = user_invitations.invited_by
      AND orig.expires_at = user_invitations.expires_at
      AND orig.status = 'pending'
  )
);