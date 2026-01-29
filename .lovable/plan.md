

# Plan: Corregir Verificación de Importes en Factura de Especialista

## Problema Detectado

La liquidación de Iolanda (LIQ-2026-008) muestra un error de verificación cuando sube su factura:
- **Factura subida:** 2.360,75 € (CORRECTO)
- **Subtotal en BD:** 2.395,75 € (INCORRECTO)
- **Suma real de items:** 2.360,75 € (CORRECTO)

La factura de Iolanda es correcta. El problema es que el campo `subtotal` en la tabla `liquidations` no se actualizó correctamente cuando se añadieron/eliminaron items individualmente.

## Causa Raíz

Cuando se añade o elimina una solicitud individual desde el detalle de la liquidación:
- Se actualiza `total_amount`
- **NO se actualiza `subtotal`**

Esto causa una desincronización entre el campo `subtotal` y la suma real de los items.

## Solución

### Enfoque: Doble corrección

1. **Corregir el Edge Function** para que calcule el subtotal desde los items reales (solución robusta)
2. **Corregir el código frontend** para que actualice `subtotal` al añadir/eliminar items (prevención)

---

## Cambio 1: Edge Function `upload-specialist-invoice`

**Archivo:** `supabase/functions/upload-specialist-invoice/index.ts`

Calcular el subtotal desde los `liquidation_items` en lugar de confiar en el campo `subtotal` de la liquidación:

```typescript
// Después de obtener la liquidación, calcular subtotal real desde items
const { data: items, error: itemsError } = await supabase
  .from('liquidation_items')
  .select('total')
  .eq('liquidation_id', liquidationId);

if (itemsError) throw itemsError;

// El subtotal real es la suma de todos los items
const liquidationSubtotal = items?.reduce((sum, item) => sum + Number(item.total), 0) || 0;
```

---

## Cambio 2: Función `addSingleRequest` en LiquidacionDetalle.tsx

**Archivo:** `src/pages/LiquidacionDetalle.tsx` (líneas 81-96)

```typescript
// Antes
const { data: liquidation, error: fetchError } = await supabase
  .from('liquidations')
  .select('total_amount')
  ...
const newTotal = (Number(liquidation.total_amount) || 0) + cost;
const { error: updateError } = await supabase
  .from('liquidations')
  .update({ total_amount: newTotal })
  ...

// Después - incluir subtotal y recálculo de impuestos
const { data: liquidation, error: fetchError } = await supabase
  .from('liquidations')
  .select('subtotal, tax_rate')
  ...
const newSubtotal = (Number(liquidation.subtotal) || 0) + cost;
const taxRate = liquidation.tax_rate || 0;
const newTaxAmount = (newSubtotal * taxRate) / 100;
const newTotal = newSubtotal + newTaxAmount;

const { error: updateError } = await supabase
  .from('liquidations')
  .update({ 
    subtotal: newSubtotal,
    tax_amount: newTaxAmount,
    total_amount: newTotal 
  })
  ...
```

---

## Cambio 3: Función `removeItemMutation` en LiquidacionDetalle.tsx

**Archivo:** `src/pages/LiquidacionDetalle.tsx` (líneas 409-416)

```typescript
// Antes
const newTotal = (liquidation?.calculated_total || 0) - (Number(item.total) || 0);
const { error: liquidationError } = await supabase
  .from('liquidations')
  .update({ total_amount: Math.max(0, newTotal) })
  ...

// Después - recalcular subtotal, impuestos y total
const currentSubtotal = Number(liquidation?.subtotal) || 0;
const taxRate = liquidation?.tax_rate || 0;
const newSubtotal = Math.max(0, currentSubtotal - (Number(item.total) || 0));
const newTaxAmount = (newSubtotal * taxRate) / 100;
const newTotal = newSubtotal + newTaxAmount;

const { error: liquidationError } = await supabase
  .from('liquidations')
  .update({ 
    subtotal: newSubtotal,
    tax_amount: newTaxAmount,
    total_amount: newTotal 
  })
  ...
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/upload-specialist-invoice/index.ts` | Calcular subtotal desde items reales |
| `src/pages/LiquidacionDetalle.tsx` | Actualizar subtotal en addSingleRequest y removeItemMutation |

---

## Corrección de Datos Existentes

Para arreglar la liquidación de Iolanda (datos ya incorrectos), se debe ejecutar manualmente:

```sql
UPDATE liquidations 
SET subtotal = 2360.75,
    tax_amount = (2360.75 * tax_rate / 100),
    total_amount = 2360.75 + (2360.75 * tax_rate / 100)
WHERE id = '89222442-2e8c-4541-ae81-4d9058080965';
```

---

## Resultado Esperado

1. Al subir la factura (2.360,75 €), el sistema comparará con la suma real de items (2.360,75 €)
2. Los importes coincidirán y se mostrará "Importes verificados" en lugar de "Discrepancia de importes"
3. Futuras operaciones de añadir/eliminar items mantendrán los totales sincronizados

