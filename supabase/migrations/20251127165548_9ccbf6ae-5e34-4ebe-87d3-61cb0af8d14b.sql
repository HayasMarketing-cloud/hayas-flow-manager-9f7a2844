-- Add client_contact_id column to financial_requests table
ALTER TABLE public.financial_requests 
ADD COLUMN client_contact_id uuid REFERENCES public.client_contacts(id);

COMMENT ON COLUMN public.financial_requests.client_contact_id IS 'Contacto del cliente que solicita este request';