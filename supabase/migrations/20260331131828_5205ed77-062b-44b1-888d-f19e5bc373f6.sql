
-- Table to track validated/closed financial months
CREATE TABLE public.closed_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  closed_by uuid NOT NULL REFERENCES public.profiles(id),
  closed_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  UNIQUE(year, month)
);

-- Enable RLS
ALTER TABLE public.closed_months ENABLE ROW LEVEL SECURITY;

-- Only admin and finanzas can manage closed months
CREATE POLICY "Admin and finanzas can manage closed_months"
  ON public.closed_months
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role));

-- All authenticated users can view closed months
CREATE POLICY "Authenticated users can view closed_months"
  ON public.closed_months
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
