-- ==============================================================================
-- Migration: Fix specialist linking and owner_user_id for operational projects
-- ==============================================================================

-- 1. BACKFILL: Link specialists to users by matching email (case-insensitive)
-- This links specialists.user_id to profiles.id where emails match
UPDATE public.specialists s
SET user_id = p.id
FROM public.profiles p
WHERE 
  s.user_id IS NULL
  AND s.email IS NOT NULL
  AND lower(s.email) = lower(p.email);

-- 2. BACKFILL: Set owner_user_id = created_by where null
-- This ensures projects have an owner for RLS visibility
UPDATE public.operational_projects
SET owner_user_id = created_by
WHERE owner_user_id IS NULL AND created_by IS NOT NULL;

-- 3. Create a function that users can call to link themselves to their specialist record
-- This runs with elevated privileges to update specialists table safely
CREATE OR REPLACE FUNCTION public.link_my_specialist()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_specialist_id uuid;
BEGIN
  -- Get the authenticated user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;
  
  IF v_user_email IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Find a specialist with matching email that isn't already linked
  SELECT id INTO v_specialist_id
  FROM public.specialists
  WHERE 
    lower(email) = lower(v_user_email)
    AND (user_id IS NULL OR user_id = v_user_id)
  LIMIT 1;
  
  IF v_specialist_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Link the specialist to this user
  UPDATE public.specialists
  SET user_id = v_user_id
  WHERE id = v_specialist_id AND user_id IS NULL;
  
  RETURN v_specialist_id;
END;
$$;

-- 4. Create trigger to auto-set owner_user_id on new projects
CREATE OR REPLACE FUNCTION public.set_project_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_user_id IS NULL THEN
    NEW.owner_user_id := NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_project_owner_trigger ON public.operational_projects;
CREATE TRIGGER set_project_owner_trigger
  BEFORE INSERT ON public.operational_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_owner();