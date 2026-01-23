-- Add RLS policy to allow users to insert their own profile when they have an invitation
CREATE POLICY "Users can create own profile with invitation"
ON public.profiles
FOR INSERT
WITH CHECK (
  auth.uid() = id
  AND EXISTS (
    SELECT 1 FROM user_invitations
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'pending'
    AND expires_at > now()
  )
);

-- Add policy to allow users to update invitation status for their email
CREATE POLICY "Users can accept their own invitation"
ON public.user_invitations
FOR UPDATE
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND status = 'pending'
)
WITH CHECK (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND status IN ('pending', 'accepted')
);

-- Add policy to allow users to read their own invitation
CREATE POLICY "Users can view their own invitation"
ON public.user_invitations
FOR SELECT
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Add policy to allow users to insert their own roles from invitation
CREATE POLICY "Users can insert own roles from invitation"
ON public.user_roles
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM user_invitations
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status IN ('pending', 'accepted')
  )
);