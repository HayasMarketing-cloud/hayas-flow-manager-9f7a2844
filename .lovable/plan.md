

## Plan: Fix RLS policies on `client_contacts` for Project Managers

### Problem
The RLS INSERT policy on `client_contacts` only allows `admin` and `account_manager` roles. When Tomás (a PM) tries to create a contact, it fails with "new row violates row-level security policy".

### Current policies
- **INSERT**: `has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'account_manager')`
- **UPDATE**: Same as INSERT — also excludes PM

### Change
Run a database migration to update the INSERT and UPDATE policies to include `project_manager`:

```sql
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
```

DELETE policy remains restricted to admin and AM as intended.

