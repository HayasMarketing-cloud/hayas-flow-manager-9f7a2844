CREATE OR REPLACE FUNCTION public.prevent_duplicate_budget_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Sólo aplica a regeneraciones: la nueva fila viene vinculada a una línea,
  -- y ya existe un request equivalente del mismo presupuesto que quedó huérfano.
  IF NEW.budget_id IS NOT NULL AND NEW.budget_item_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.financial_requests fr
      WHERE fr.budget_id = NEW.budget_id
        AND fr.budget_item_id IS NULL
        AND fr.status <> 'cancelled'
        AND fr.title = NEW.title
        AND fr.quantity = NEW.quantity
        AND COALESCE(fr.unit_price, 0) = COALESCE(NEW.unit_price, 0)
    ) THEN
      RAISE EXCEPTION
        'Ya existe un request equivalente sin vínculo a línea para este presupuesto: %. Revisa antes de regenerar.',
        NEW.title;
    END IF;
  END IF;
  RETURN NEW;
END $$;