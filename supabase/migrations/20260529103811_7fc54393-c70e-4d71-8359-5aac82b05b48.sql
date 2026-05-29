
-- Fix: notifications INSERT — restrict user_id to self or service role
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Users can create own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix: specialists INSERT — restrict user_id to self or NULL to prevent account hijacking
DROP POLICY IF EXISTS "Los usuarios autenticados pueden crear especialistas" ON public.specialists;
CREATE POLICY "Los usuarios autenticados pueden crear especialistas"
ON public.specialists
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (user_id IS NULL OR user_id = auth.uid())
);

-- Fix: liquidation_invoices specialist INSERT — route uploads through edge function only
DROP POLICY IF EXISTS "Specialists can insert own liquidation invoices" ON public.liquidation_invoices;
