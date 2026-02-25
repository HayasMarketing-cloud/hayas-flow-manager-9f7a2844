

## Permitir invitaciones a usuarios externos (sin @hayas.es)

Actualmente el sistema restringe el acceso exclusivamente a emails `@hayas.es`. Este cambio permitira invitar a usuarios con cualquier dominio de email, manteniendo la seguridad (solo usuarios invitados pueden acceder) y anadiendo flujo completo de contrasena.

### Flujo propuesto

```text
ADMIN                          USUARIO EXTERNO
  |                                  |
  |-- Invita sr@wearefolly.com -->   |
  |   (sin restriccion de dominio)   |
  |                                  |
  |   <-- Recibe email ------------- |
  |       con link a /auth           |
  |                                  |
  |                     Abre /auth -->|
  |                     Ve formulario |
  |                     "Crear cuenta"|
  |                     Pone password |
  |                                  |
  |              Trigger DB crea --->|
  |              perfil + roles      |
  |                                  |
  |              Accede al sistema   |
  |                                  |
  |         Si olvida password:      |
  |         "Olvidé mi contraseña"   |
  |         --> email de reset       |
  |         --> /reset-password      |
```

Para usuarios `@hayas.es`, el flujo de Google OAuth sigue funcionando igual.

### Cambios necesarios

#### 1. Auth page (`src/pages/Auth.tsx`)
- Eliminar texto "Solo para usuarios con email @hayas.es"
- Hacer el formulario de email/contrasena mas prominente (no colapsado)
- Anadir pestana o modo "Crear cuenta" para usuarios invitados externos (pide email + contrasena + nombre)
- Anadir enlace "Olvidé mi contraseña" que llame a `supabase.auth.resetPasswordForEmail()`
- Mantener boton de Google para usuarios @hayas.es

#### 2. Nueva pagina: Reset Password (`src/pages/ResetPassword.tsx`)
- Formulario para establecer nueva contrasena
- Detecta `type=recovery` en URL hash
- Llama a `supabase.auth.updateUser({ password })`
- Ruta publica `/reset-password` en `App.tsx`

#### 3. AuthContext (`src/contexts/AuthContext.tsx`)
- **Eliminar** la validacion de dominio `@hayas.es` en `validateUserAccess`
- Mantener validacion de invitacion (solo usuarios invitados pueden acceder)
- La seguridad se mantiene porque: sin invitacion en `user_invitations` con status `pending`, el usuario no obtiene perfil ni roles y es desconectado

#### 4. InviteUserModal (`src/components/users/InviteUserModal.tsx`)
- **Eliminar** validacion `emailLower.endsWith('@hayas.es')`
- Actualizar texto descriptivo: "Invita a un nuevo usuario al sistema" (sin mencion a @hayas.es)
- Actualizar placeholder del input a "usuario@ejemplo.com"

#### 5. Edge function `send-user-invitation`
- **Eliminar** validacion `recipientEmail.endsWith('@hayas.es')`
- Adaptar el contenido del email: si el destinatario NO es @hayas.es, indicar que debe crear cuenta con email y contrasena (en lugar de "usa tu cuenta de Google")
- Si es @hayas.es, mantener instrucciones de Google

#### 6. Funcion `signUp` en AuthContext
- Ya existe pero actualmente no se usa desde la UI
- Eliminar restriccion de dominio en la validacion del signup
- Asegurar que el `handle_new_user` trigger en la DB maneje correctamente el signup con contrasena

#### 7. Ruta en `App.tsx`
- Anadir ruta `/reset-password` como ruta publica

#### 8. PWA config (`vite.config.ts`)
- Anadir `/~oauth` al `navigateFallbackDenylist` (ya requerido por configuracion)

### Seguridad

- **La invitacion sigue siendo obligatoria**: Sin entrada en `user_invitations` con status `pending`, el trigger `handle_new_user` no crea perfil, y el `AuthContext` desconecta al usuario
- **Roles se asignan solo desde la invitacion**: El admin define los roles al invitar
- **Password reset seguro**: Usa el flujo nativo de Supabase Auth con email de verificacion
- **Sin auto-confirm**: Los usuarios externos reciben email de confirmacion antes de poder acceder (flujo estandar de Supabase)

### Detalle tecnico importante

El trigger `handle_new_user` en la DB ya maneja correctamente la creacion de perfil desde invitacion para cualquier email. No necesita cambios en la DB. La unica restriccion de dominio esta en el codigo de la aplicacion (AuthContext, InviteUserModal, edge function).

