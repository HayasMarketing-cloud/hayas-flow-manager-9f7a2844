-- Eliminar políticas antiguas que acceden a auth.users
DROP POLICY IF EXISTS "Users can view their own invitation" ON public.user_invitations;
DROP POLICY IF EXISTS "Users can accept their own invitation" ON public.user_invitations;

-- Recrear políticas usando auth.email()
CREATE POLICY "Users can view their own invitation"
ON public.user_invitations
FOR SELECT
TO authenticated
USING (email = auth.email());

CREATE POLICY "Users can accept their own invitation"
ON public.user_invitations
FOR UPDATE
TO authenticated
USING ((email = auth.email()) AND (status = 'pending'))
WITH CHECK ((email = auth.email()) AND (status = ANY (ARRAY['pending'::text, 'accepted'::text])));