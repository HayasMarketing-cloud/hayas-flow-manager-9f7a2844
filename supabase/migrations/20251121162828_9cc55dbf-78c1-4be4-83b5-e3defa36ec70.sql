-- Corregir search_path en función principal generate_code

CREATE OR REPLACE FUNCTION public.generate_code(sequence_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq_record RECORD;
  new_code TEXT;
  current_year INTEGER := EXTRACT(YEAR FROM NOW());
BEGIN
  -- Obtener o crear el registro de secuencia
  SELECT * INTO seq_record FROM public.sequences WHERE name = sequence_name FOR UPDATE;

  IF NOT FOUND THEN
    -- Crear nueva secuencia si no existe
    INSERT INTO public.sequences (name, prefix, current_value, year)
    VALUES (sequence_name, UPPER(LEFT(sequence_name, 3)), 0, current_year)
    RETURNING * INTO seq_record;
  END IF;

  -- Resetear contador si cambió el año
  IF seq_record.year != current_year THEN
    UPDATE public.sequences 
    SET current_value = 0, year = current_year, updated_at = NOW()
    WHERE name = sequence_name;
    seq_record.current_value := 0;
    seq_record.year := current_year;
  END IF;

  -- Incrementar contador
  UPDATE public.sequences 
  SET current_value = current_value + 1, updated_at = NOW()
  WHERE name = sequence_name;

  -- Generar código: PREFIX-YEAR-NUM (ej: REQ-2025-001)
  new_code := seq_record.prefix || '-' || current_year || '-' || LPAD((seq_record.current_value + 1)::TEXT, 3, '0');

  RETURN new_code;
END;
$$;