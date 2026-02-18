
## Plan: Solución completa del bug de duplicación

### Causa raíz identificada

Hay DOS ficheros con el mismo bug, y solo se corrigió uno:

| Fichero | Estado | Usado cuando |
|---|---|---|
| `src/pages/Presupuestos.tsx` | Corregido | Duplicar desde la lista |
| `src/pages/PresupuestoDetalle.tsx` | BUG ACTIVO | Duplicar desde la página de detalle |

Iolanda accedió a la URL directa del presupuesto fantasma PRE-2026-012 (el navegador la tenía en el historial) y duplicó desde allí. Esa ruta usa `PresupuestoDetalle.tsx`, que no hereda `am_user_id` ni `pm_user_id`.

### Lo que se va a hacer

**1. Corregir `PresupuestoDetalle.tsx` — duplicateMutation (líneas 322-334)**

Añadir `am_user_id`, `pm_user_id`, `contract_id` y `estimated_invoice_date` al insertar la copia, igual que se hizo en `Presupuestos.tsx`.

Cambio:
```typescript
// ANTES
.insert({
  title: `${budget.title} (Copia)`,
  client_id: budget.client_id,
  description: budget.description,
  valid_until: budget.valid_until,
  total_amount: budget.total_amount,
  status: 'pending',
  created_by: user?.id,
})

// DESPUÉS
.insert({
  title: `${budget.title} (Copia)`,
  client_id: budget.client_id,
  description: budget.description,
  valid_until: budget.valid_until,
  estimated_invoice_date: budget.estimated_invoice_date,
  total_amount: budget.total_amount,
  status: 'pending',
  created_by: user?.id,
  am_user_id: budget.am_user_id,
  pm_user_id: budget.pm_user_id,
  contract_id: budget.contract_id,
})
```

**2. Corregir `Presupuestos.tsx` — convertToContractMutation**

Añadir `am_user_id` y `pm_user_id` al crear un contrato desde un presupuesto aprobado, para que Iolanda también vea el contrato resultante en su lista.

**3. Eliminar los 3 presupuestos fantasma de la base de datos**

Los tres clones sin AM/PM asignado se borran en cascada (primero sus items, luego los presupuestos):
- PRE-2026-011 (`1798360d-c1a3-43a7-87a3-5f612dd81bbd`)
- PRE-2026-012 (`3bbb01f1-5f76-41b6-84ac-4ba45dc3df95`)
- PRE-2026-013 (`facf8921-8e81-4c3a-9890-a7f0837af46b`)

Ninguno tiene solicitudes ni proyectos asociados (confirmado previamente).

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/PresupuestoDetalle.tsx` | Líneas 326-334: Añadir `am_user_id`, `pm_user_id`, `contract_id`, `estimated_invoice_date` |
| `src/pages/Presupuestos.tsx` | Líneas ~215-225: Añadir `am_user_id`, `pm_user_id` en `convertToContractMutation` |
| Base de datos | Eliminar 3 presupuestos fantasma y sus items |

### Resultado esperado

- Duplicar desde la lista o desde la página de detalle produce siempre una copia con el AM/PM del original.
- Los 3 fantasmas desaparecen.
- Cuando un presupuesto aprobado se convierte a contrato, el contrato hereda el AM/PM y aparece en la lista de Iolanda.
- No pueden volver a generarse presupuestos "invisibles" por este motivo.
