
-- 1) Specialists UPDATE: prevent identity hijack on already-linked records
DROP POLICY IF EXISTS "Los usuarios pueden actualizar especialistas que crearon" ON public.specialists;

CREATE POLICY "Los usuarios pueden actualizar especialistas que crearon"
ON public.specialists
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    created_by = auth.uid()
    AND (user_id IS NULL OR user_id = auth.uid())
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    created_by = auth.uid()
    AND (user_id IS NULL OR user_id = auth.uid())
  )
);

-- 2) liquidation_signatures: allow specialist to read signatures of their own liquidations
CREATE POLICY "Especialistas ven firmas de sus liquidaciones"
ON public.liquidation_signatures
FOR SELECT
TO authenticated
USING (public.is_specialist_liquidation(liquidation_id));

-- 3) request_action_tokens: explicit admin/finanzas SELECT policy.
-- Edge functions use the service role and bypass RLS; regular users get no read access.
CREATE POLICY "Admin y finanzas pueden leer tokens de acción"
ON public.request_action_tokens
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'finanzas')
);
