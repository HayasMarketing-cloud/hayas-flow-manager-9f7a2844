

## Eliminar restriccion de dominio en la base de datos

### Problema

El error `new row for relation "user_invitations" violates check constraint "email_hayas_check"` indica que existe un CHECK constraint en la tabla `user_invitations` que restringe los emails al dominio `@hayas.es`. Aunque eliminamos las validaciones en el codigo, la restriccion persiste a nivel de base de datos.

### Solucion

Ejecutar una migracion SQL para eliminar el constraint:

```sql
ALTER TABLE public.user_invitations DROP CONSTRAINT email_hayas_check;
```

Un solo cambio. Sin modificaciones de codigo.

