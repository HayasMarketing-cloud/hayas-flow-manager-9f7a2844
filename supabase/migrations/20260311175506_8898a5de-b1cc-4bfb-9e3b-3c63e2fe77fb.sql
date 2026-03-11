
-- Add short_code column
ALTER TABLE public.budget_share_tokens ADD COLUMN short_code text UNIQUE;

-- Function to generate short code from budget code
CREATE OR REPLACE FUNCTION public.generate_share_short_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  budget_code text;
  short text;
BEGIN
  -- Get the budget code (e.g. PRE-2026-018)
  SELECT code INTO budget_code FROM public.budgets WHERE id = NEW.budget_id;
  
  IF budget_code IS NOT NULL THEN
    -- Transform PRE-2026-018 → Q2026018
    short := 'Q' || replace(replace(budget_code, 'PRE-', ''), '-', '');
  ELSE
    -- Fallback: random 8-char code
    short := 'Q' || substr(md5(random()::text), 1, 7);
  END IF;
  
  -- Ensure uniqueness by appending a suffix if needed
  IF EXISTS (SELECT 1 FROM public.budget_share_tokens WHERE short_code = short AND id != NEW.id) THEN
    short := short || substr(md5(random()::text), 1, 3);
  END IF;
  
  NEW.short_code := short;
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate short_code on insert
CREATE TRIGGER set_share_short_code
  BEFORE INSERT ON public.budget_share_tokens
  FOR EACH ROW
  WHEN (NEW.short_code IS NULL)
  EXECUTE FUNCTION public.generate_share_short_code();

-- Backfill existing tokens
UPDATE public.budget_share_tokens bst
SET short_code = 'Q' || replace(replace(b.code, 'PRE-', ''), '-', '')
FROM public.budgets b
WHERE bst.budget_id = b.id AND bst.short_code IS NULL;
