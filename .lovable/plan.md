

## Plan: Corregir políticas RLS de user_invitations

### Problema identificado

Las políticas RLS de la tabla `user_invitations` intentan acceder directamente a `auth.users`, lo cual no está permitido:

```sql
-- Políticas actuales (incorrectas):
(email = (SELECT users.email FROM auth.users WHERE users.id = auth.uid()))
```

Esto causa el error **"permission denied for table users"**.

### Solución

Supabase proporciona la función `auth.email()` que devuelve el email del usuario autenticado de forma segura. Debemos actualizar las políticas RLS para usar esta función en lugar de hacer un SELECT a `auth.users`.

### Cambios a realizar

**1. Modificar política SELECT**

Cambiar de:
```sql
qual: (email = (SELECT users.email FROM auth.users WHERE users.id = auth.uid()))
```

A:
```sql
qual: (email = auth.email())
```

**2. Modificar política UPDATE**

Cambiar de:
```sql
qual: (email = (SELECT users.email FROM auth.users WHERE users.id = auth.uid())) AND (status = 'pending')
with_check: (email = (SELECT users.email...)) AND (status = ANY (ARRAY['pending', 'accepted']))
```

A:
```sql
qual: (email = auth.email()) AND (status = 'pending')
with_check: (email = auth.email()) AND (status = ANY (ARRAY['pending', 'accepted']))
```

### Migración SQL

```sql
-- Eliminar políticas antiguas que acceden a auth.users
DROP POLICY IF EXISTS "Users can view their own invitation" ON public.user_invitations;
DROP POLICY IF EXISTS "Users can accept their own invitation" ON public.user_invitations;

-- Recrear políticas usando auth.email()
CREATE POLICY "Users can view their own invitation"
ON public.user_invitations
FOR SELECT
TO authenticated
USING (email = auth.email());

CREATE POLICY "Users can accept their own invitation"
ON public.user_invitations
FOR UPDATE
TO authenticated
USING ((email = auth.email()) AND (status = 'pending'))
WITH CHECK ((email = auth.email()) AND (status = ANY (ARRAY['pending', 'accepted'])));
```

### Verificación

Tras aplicar la migración:
1. Admins pueden gestionar todas las invitaciones (política existente OK)
2. Usuarios pueden ver sus propias invitaciones usando `auth.email()`
3. Usuarios pueden aceptar sus propias invitaciones pendientes

### Detalles técnicos

La política de admin (`has_role(auth.uid(), 'admin')`) no se ve afectada y funciona correctamente porque usa la función `has_role` que es `SECURITY DEFINER`.

