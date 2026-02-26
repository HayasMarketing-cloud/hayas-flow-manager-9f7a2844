

## Problema: Google OAuth muestra URL de Supabase en la PWA

### Diagnostico

Cuando el usuario abre la app instalada (PWA) y pulsa "Continuar con Google", la pantalla de Google muestra la URL del proyecto de backend (`zqaeokujqipntjhmbjgi.supabase.co`) en lugar del dominio de la aplicacion (`hayas-flow-manager.lovable.app`). Esto ocurre porque el codigo actual usa `supabase.auth.signInWithOAuth()` directamente, en lugar de la solucion gestionada de Lovable Cloud.

### Solucion

Migrar el inicio de sesion con Google a `lovable.auth.signInWithOAuth()`, que es la solucion gestionada por Lovable Cloud. Esto hara que Google muestre el dominio correcto de la aplicacion.

### Cambios necesarios

#### 1. Configurar Google OAuth con la herramienta de Lovable Cloud
- Ejecutar la herramienta `configure-social-auth` para generar el modulo `src/integrations/lovable/`
- Esto instalara automaticamente `@lovable.dev/cloud-auth-js`

#### 2. Actualizar `src/contexts/AuthContext.tsx`
- Importar el modulo lovable: `import { lovable } from "@/integrations/lovable/index"`
- Reemplazar `supabase.auth.signInWithOAuth()` por `lovable.auth.signInWithOAuth("google", { ... })`
- Mantener el parametro `hd: "hayas.es"` usando `extraParams`

```typescript
// Antes:
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/dashboard-mensual`,
    queryParams: { hd: 'hayas.es' },
  },
});

// Despues:
const { error } = await lovable.auth.signInWithOAuth("google", {
  redirect_uri: window.location.origin,
  extraParams: { hd: 'hayas.es' },
});
```

#### 3. No se requieren cambios en la PWA
- La configuracion de `navigateFallbackDenylist` con `/~oauth` ya esta correcta en `vite.config.ts`

### Resultado esperado
Google mostrara el dominio de la aplicacion (lovable.app o custom domain) en lugar de la URL del backend, y el flujo OAuth funcionara correctamente desde la PWA instalada.

