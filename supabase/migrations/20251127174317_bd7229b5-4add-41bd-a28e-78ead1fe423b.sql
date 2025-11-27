-- Add code and enable_auto_requests columns to contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS code VARCHAR NOT NULL DEFAULT '';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS enable_auto_requests BOOLEAN DEFAULT false;

-- Insert sequence for contracts if not exists
INSERT INTO public.sequences (name, prefix, current_value, year)
VALUES ('contracts', 'CON', 0, EXTRACT(YEAR FROM NOW())::INTEGER)
ON CONFLICT (name) DO NOTHING;

-- Create trigger function to auto-generate contract code
CREATE OR REPLACE FUNCTION public.generate_contract_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_code('contracts');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Create trigger for contract code generation
DROP TRIGGER IF EXISTS trg_generate_contract_code ON public.contracts;
CREATE TRIGGER trg_generate_contract_code
  BEFORE INSERT ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_contract_code();