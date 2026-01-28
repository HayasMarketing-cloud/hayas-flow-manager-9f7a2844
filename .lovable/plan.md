

# Plan: Restringir Notificaciones de Liquidaciones a Admin y Finanzas

## Resumen del Cambio

Simplificar la lógica de notificaciones de liquidaciones para que **únicamente los usuarios con roles `admin` y `finanzas`** reciban notificaciones cuando un especialista acepta o disputa una liquidación. Los Account Managers y Project Managers validarán las liquidaciones en un paso previo, por lo que no necesitan recibir estas notificaciones.

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/process-signature/index.ts` | Eliminar `account_manager` de la lista de roles (línea 241) |
| `src/lib/notification-utils.ts` | Actualizar funciones de liquidación para solo notificar a admin/finanzas |

## Cambios Detallados

### 1. Edge Function: `process-signature/index.ts`

**Ubicación**: Línea 241

**Antes:**
```typescript
.in('role', ['admin', 'account_manager', 'finanzas']);
```

**Después:**
```typescript
.in('role', ['admin', 'finanzas']);
```

### 2. Frontend: `notification-utils.ts`

#### Función `notifyLiquidationSigned` (líneas 165-182)

**Antes:**
```typescript
await notifyByRole(
  ['admin', 'finanzas', 'account_manager', 'project_manager'],
  { ... }
);
```

**Después:**
```typescript
await notifyByRole(
  ['admin', 'finanzas'],
  { ... }
);
```

#### Función `notifyLiquidationAccepted` (líneas 210-227)

**Antes:**
```typescript
await notifyByRole(
  ['admin', 'finanzas', 'account_manager'],
  { ... }
);
```

**Después:**
```typescript
await notifyByRole(
  ['admin', 'finanzas'],
  { ... }
);
```

#### Función `notifyLiquidationDisputed` (líneas 230-248)

**Antes:**
```typescript
await notifyByRole(
  ['admin', 'finanzas', 'account_manager', 'project_manager'],
  { ... }
);
```

**Después:**
```typescript
await notifyByRole(
  ['admin', 'finanzas'],
  { ... }
);
```

## Resultado Esperado

Después de la implementación:

| Rol | Recibe notificación de liquidación |
|-----|-----------------------------------|
| Admin | ✅ Sí |
| Finanzas | ✅ Sí |
| Account Manager | ❌ No |
| Project Manager | ❌ No |
| Especialista | ✅ Sí (solo su propia liquidación enviada) |

## Verificación

1. Cuando Daniela acepte una liquidación → Ebelyn (AM) NO recibirá email ni notificación in-app
2. Ruben (admin) y usuarios con rol finanzas seguirán recibiendo todas las notificaciones
3. El especialista seguirá recibiendo la notificación cuando se le envíe una nueva liquidación para revisar

