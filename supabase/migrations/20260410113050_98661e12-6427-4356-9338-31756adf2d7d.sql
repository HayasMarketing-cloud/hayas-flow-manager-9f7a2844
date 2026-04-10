
DROP POLICY "Admin y AM pueden crear contactos" ON public.client_contacts;
CREATE POLICY "Admin AM y PM pueden crear contactos" ON public.client_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'account_manager'::app_role)
    OR has_role(auth.uid(), 'project_manager'::app_role)
  );

DROP POLICY "Admin y AM pueden actualizar contactos" ON public.client_contacts;
CREATE POLICY "Admin AM y PM pueden actualizar contactos" ON public.client_contacts
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'account_manager'::app_role)
    OR has_role(auth.uid(), 'project_manager'::app_role)
  );
