-- Create client_contacts table
CREATE TABLE public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text,
  phone text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country text,
  notes text,
  is_primary boolean DEFAULT false,
  active boolean DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can view contacts
CREATE POLICY "Usuarios autenticados pueden ver contactos"
ON public.client_contacts FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RLS Policy: Admin and AM can create contacts
CREATE POLICY "Admin y AM pueden crear contactos"
ON public.client_contacts FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'account_manager'::app_role)
);

-- RLS Policy: Admin and AM can update contacts
CREATE POLICY "Admin y AM pueden actualizar contactos"
ON public.client_contacts FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'account_manager'::app_role)
);

-- RLS Policy: Admin and AM can delete contacts
CREATE POLICY "Admin y AM pueden eliminar contactos"
ON public.client_contacts FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'account_manager'::app_role)
);

-- Trigger function to ensure only one primary contact per client
CREATE OR REPLACE FUNCTION public.ensure_single_primary_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act if is_primary is being set to true
  IF NEW.is_primary = true THEN
    -- Unmark any existing primary contact for this client
    UPDATE public.client_contacts
    SET is_primary = false
    WHERE client_id = NEW.client_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for single primary contact
CREATE TRIGGER trigger_ensure_single_primary_contact
  BEFORE INSERT OR UPDATE OF is_primary ON public.client_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_primary_contact();

-- Create trigger for updated_at
CREATE TRIGGER update_client_contacts_updated_at
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();