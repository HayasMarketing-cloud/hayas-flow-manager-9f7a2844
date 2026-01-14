-- Añadir columnas para Account Manager y Project Manager en budgets
ALTER TABLE public.budgets 
ADD COLUMN am_user_id uuid REFERENCES public.profiles(id),
ADD COLUMN pm_user_id uuid REFERENCES public.profiles(id);

-- Comentarios para documentación
COMMENT ON COLUMN public.budgets.am_user_id IS 'Account Manager asignado al presupuesto';
COMMENT ON COLUMN public.budgets.pm_user_id IS 'Project Manager asignado al presupuesto';