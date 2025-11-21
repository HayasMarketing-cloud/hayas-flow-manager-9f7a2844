-- Corregir search_path en funciones de generación de códigos

CREATE OR REPLACE FUNCTION generate_request_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_code('requests');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION generate_invoice_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_code('invoices');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION generate_liquidation_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_code('liquidations');
  END IF;
  RETURN NEW;
END;
$$;