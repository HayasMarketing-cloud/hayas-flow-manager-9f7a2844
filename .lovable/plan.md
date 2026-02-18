
## Plan: Corregir Duplicación de Presupuestos para Usuarios AM/PM

### Problema Identificado

Al duplicar un presupuesto, el código actual NO copia los campos `am_user_id` y `pm_user_id` del presupuesto original. Esto provoca que:

1. El presupuesto SÍ se crea en la base de datos (confirmado: existen PRE-2026-011 y PRE-2026-012).
2. Pero como Iolanda es `account_manager`, la query filtra solo presupuestos donde ella es AM o PM.
3. La copia tiene `am_user_id = NULL`, por lo que el filtro la excluye y ella no la ve.
4. Al no ver ningún resultado, hizo clic dos veces generando dos duplicados.

### Estado Actual en Base de Datos

Hay dos presupuestos duplicados que deben limpiarse:
- PRE-2026-011: "Rebranding Website Home (Copia)" — sin AM/PM
- PRE-2026-012: "Rebranding Website Home (Copia)" — sin AM/PM

El original es PRE-2026-006: "Rebranding Website Home" — con `am_user_id = 907cc972...` (Iolanda).

### Solución

**1. Corregir el código de duplicación** en `Presupuestos.tsx` para incluir `am_user_id` y `pm_user_id` al crear la copia.

**Código actual (incorrecto):**
```typescript
const { data: newBudget, error: budgetError } = await supabase
  .from('budgets')
  .insert({
    title: `${budget.title} (Copia)`,
    client_id: budget.client_id,
    description: budget.description,
    valid_until: budget.valid_until,
    total_amount: budget.total_amount,
    status: 'pending',
    created_by: user?.id,
    // ❌ am_user_id y pm_user_id NO se copian
  })
```

**Código corregido:**
```typescript
const { data: newBudget, error: budgetError } = await supabase
  .from('budgets')
  .insert({
    title: `${budget.title} (Copia)`,
    client_id: budget.client_id,
    description: budget.description,
    valid_until: budget.valid_until,
    estimated_invoice_date: budget.estimated_invoice_date,
    total_amount: budget.total_amount,
    status: 'pending',
    created_by: user?.id,
    am_user_id: budget.am_user_id,   // ✅ Copiar AM
    pm_user_id: budget.pm_user_id,   // ✅ Copiar PM
    contract_id: budget.contract_id, // ✅ Copiar contrato vinculado
  })
```

**2. Limpiar los dos duplicados incorrectos** de la base de datos (PRE-2026-011 y PRE-2026-012) que quedaron sin AM/PM asignado. Primero se borran sus items, luego los presupuestos.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Presupuestos.tsx` | Líneas 153-163: Añadir `am_user_id`, `pm_user_id`, `contract_id` y `estimated_invoice_date` al insertar la copia |

### Limpieza de Datos

Se ejecutará un script SQL para eliminar los dos presupuestos incorrectos (PRE-2026-011 y PRE-2026-012) y sus items asociados.

### Resultado Esperado

- Al duplicar un presupuesto, la copia hereda el AM y PM del original.
- El usuario que duplica siempre verá la copia en su lista.
- Los dos duplicados incorrectos quedan eliminados.
- No se vuelven a generar presupuestos "fantasma" invisibles para su creador.
