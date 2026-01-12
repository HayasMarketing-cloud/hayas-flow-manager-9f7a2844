-- Create user_invitations table for managing user invitations
CREATE TABLE public.user_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    invited_by uuid NOT NULL,
    roles app_role[] NOT NULL DEFAULT '{user}',
    status text NOT NULL DEFAULT 'pending',
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    accepted_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT email_hayas_check CHECK (email LIKE '%@hayas.es'),
    CONSTRAINT unique_pending_email UNIQUE (email) -- Only one pending invite per email
);

-- Enable RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can manage invitations
CREATE POLICY "Admins can manage invitations" 
ON public.user_invitations
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Update trigger for updated_at
CREATE TRIGGER update_user_invitations_updated_at
BEFORE UPDATE ON public.user_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Replace handle_new_user function to check for valid invitation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  invitation_record RECORD;
  role_to_assign app_role;
BEGIN
  -- Check for valid invitation
  SELECT * INTO invitation_record
  FROM public.user_invitations
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > now();

  -- If no valid invitation exists, don't create profile
  -- The AuthContext will handle sign out
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Create profile for invited user
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  -- Assign all roles from the invitation
  FOREACH role_to_assign IN ARRAY invitation_record.roles
  LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, role_to_assign)
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;

  -- Mark invitation as accepted
  UPDATE public.user_invitations
  SET status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = invitation_record.id;

  RETURN NEW;
END;
$$;