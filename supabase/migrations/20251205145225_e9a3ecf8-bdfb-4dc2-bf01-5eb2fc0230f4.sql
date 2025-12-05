-- 1. Añadir campo code a la tabla budgets
ALTER TABLE public.budgets 
ADD COLUMN code character varying NOT NULL DEFAULT '';

-- 2. Crear entrada en sequences con valor inicial 199 
-- (así el primer código será PRE-2025-200)
INSERT INTO public.sequences (name, prefix, current_value, year)
VALUES ('budgets', 'PRE', 199, EXTRACT(YEAR FROM NOW())::integer)
ON CONFLICT DO NOTHING;

-- 3. Crear función para generar código de presupuesto
CREATE OR REPLACE FUNCTION public.generate_budget_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_code('budgets');
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Crear trigger para autogenerar código antes de insertar
CREATE TRIGGER generate_budget_code_trigger
BEFORE INSERT ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.generate_budget_code();

-- 5. Actualizar presupuestos existentes sin código
UPDATE public.budgets 
SET code = public.generate_code('budgets') 
WHERE code IS NULL OR code = '';