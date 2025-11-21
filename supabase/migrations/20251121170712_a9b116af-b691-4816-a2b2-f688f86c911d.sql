-- PASO 8.0: Agregar user_id a specialists y actualizar RLS policies

-- 1. Agregar columna user_id a specialists (si no existe)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'specialists' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.specialists
    ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Crear índice para mejorar performance de queries
CREATE INDEX IF NOT EXISTS idx_specialists_user_id ON public.specialists(user_id);

-- 3. Actualizar RLS policies de liquidations
-- Eliminar la política restrictiva actual de SELECT
DROP POLICY IF EXISTS "Finance and admin can view liquidations" ON public.liquidations;

-- Crear nueva política que incluye especialistas viendo las suyas
CREATE POLICY "Users can view relevant liquidations"
  ON public.liquidations FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finanzas'::app_role) OR
    specialist_id IN (
      SELECT id FROM public.specialists 
      WHERE user_id = auth.uid()
    )
  );

-- 4. Actualizar RLS policies para liquidation_items
-- Eliminar políticas existentes primero
DROP POLICY IF EXISTS "Finance and admin can manage liquidation items" ON public.liquidation_items;
DROP POLICY IF EXISTS "Users can view relevant liquidation items" ON public.liquidation_items;

-- Policy SELECT: heredar permisos de liquidations
CREATE POLICY "Users can view relevant liquidation items"
  ON public.liquidation_items FOR SELECT
  TO authenticated
  USING (
    liquidation_id IN (
      SELECT id FROM public.liquidations
      WHERE has_role(auth.uid(), 'admin'::app_role) 
         OR has_role(auth.uid(), 'finanzas'::app_role)
         OR specialist_id IN (
           SELECT id FROM public.specialists WHERE user_id = auth.uid()
         )
    )
  );

-- Policy INSERT/UPDATE/DELETE: solo admin y finanzas
CREATE POLICY "Finance and admin can manage liquidation items"
  ON public.liquidation_items FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finanzas'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finanzas'::app_role)
  );