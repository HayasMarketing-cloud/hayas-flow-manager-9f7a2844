DROP POLICY IF EXISTS "Admins and PMs can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins and PMs can update all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins and PMs can delete all tasks" ON public.tasks;

CREATE POLICY "Admins and PMs can view all tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'project_manager'::public.app_role)
);

CREATE POLICY "Admins and PMs can update all tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'project_manager'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'project_manager'::public.app_role)
);

CREATE POLICY "Admins and PMs can delete all tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'project_manager'::public.app_role)
);