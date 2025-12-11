-- Add client_contact_id to budgets table
ALTER TABLE public.budgets 
ADD COLUMN client_contact_id uuid REFERENCES public.client_contacts(id);