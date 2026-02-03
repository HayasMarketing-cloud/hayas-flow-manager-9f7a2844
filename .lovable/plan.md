

## Problema Identificado

La factura 2026/8 no muestra la asociación a presupuesto porque **nunca se guardó en la base de datos**. El problema está en el modal de edición de facturas.

### Diagnóstico

**Verificación en base de datos:**
- `invoice_budget_allocations` para factura 2026/8: **0 registros**
- `invoices.budget_id` para factura 2026/8: **null**
- `invoices.contract_id` para factura 2026/8: **null**

Esto confirma que cuando el usuario "guardó" la asociación, la operación no se ejecutó correctamente.

### Causa Raíz: Race Condition en useEffect

El `useEffect` en `InvoiceFormModal.tsx` (líneas 143-210) tiene dependencias problemáticas:

```typescript
useEffect(() => {
  if (invoice && mode !== 'create') {
    // ...carga datos...
    if (existingAllocations.length > 0) {
      setAssociationType('budgets');
    } else if (invoice.contract_id) {
      setAssociationType('contract');
    } else {
      setAssociationType('none'); // ⚠️ PROBLEMA: Se resetea a 'none'
    }
  }
}, [invoice, mode, reset, existingAllocations, availableBudgets]); // ⚠️ Dependencias asíncronas
```

**Secuencia del bug:**

1. Usuario abre factura 2026/8 (sin asociaciones previas)
2. `useEffect` se ejecuta → `existingAllocations = []` → `associationType = 'none'`
3. Usuario selecciona "Presupuesto(s)" y añade una asignación → `associationType = 'budgets'`
4. Mientras el usuario trabaja, `availableBudgets` termina de cargar (query asíncrono)
5. El `useEffect` se RE-EJECUTA por el cambio en `availableBudgets`
6. Como `existingAllocations` sigue vacío → `associationType = 'none'` **¡SE RESETEA!**
7. Usuario hace clic en "Guardar" con `associationType = 'none'`
8. El código en línea 365-370 ejecuta: `allocations: []` (array vacío)

---

## Solución Propuesta

### Cambio 1: Evitar re-ejecución innecesaria del useEffect

Añadir un flag `hasInitialized` para que el efecto solo inicialice el estado **una vez** al abrir el modal, y no reaccione a cambios posteriores de los datos asíncronos:

```typescript
const [hasInitialized, setHasInitialized] = useState(false);

useEffect(() => {
  // Solo inicializar una vez cuando tenemos los datos necesarios
  if (invoice && mode !== 'create' && !hasInitialized && 
      existingAllocations !== undefined && availableBudgets !== undefined) {
    
    // ... lógica de inicialización ...
    
    setHasInitialized(true);
  }
}, [invoice, mode, existingAllocations, availableBudgets, hasInitialized]);

// Reset flag cuando cambia el invoice
useEffect(() => {
  setHasInitialized(false);
}, [invoice?.id]);
```

### Cambio 2: Separar inicialización de form y asociaciones

Dividir el `useEffect` monolítico en dos efectos separados:
1. **Efecto para datos del formulario** (síncronos desde `invoice`)
2. **Efecto para asociaciones** (dependiente de datos asíncronos, pero con protección contra re-reseteo)

### Cambio 3: Añadir logging de depuración

Agregar logs en `useSaveInvoiceAllocations` para detectar cuando se guardan arrays vacíos:

```typescript
console.log(`[SaveAllocations] Guardando ${allocations.length} asignaciones para factura ${invoiceId}`);
if (allocations.length === 0) {
  console.warn('[SaveAllocations] ⚠️ Se está guardando un array vacío de asignaciones');
}
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/modals/InvoiceFormModal.tsx` | Añadir flag `hasInitialized` y separar useEffects |
| `src/hooks/useInvoiceBudgetAllocations.tsx` | Añadir logs de depuración (opcional pero recomendado) |

---

## Resultado Esperado

1. El usuario abre la factura 2026/8 en modo edición
2. Selecciona "Presupuesto(s)" y añade una asignación
3. Los datos asíncronos (`availableBudgets`) terminan de cargar
4. **El estado `associationType` NO se resetea** porque `hasInitialized = true`
5. El usuario guarda y la asignación se persiste correctamente
6. La columna "Asociación" muestra el presupuesto vinculado

