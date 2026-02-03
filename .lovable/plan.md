

## Problema Identificado

El problema tiene **dos causas principales**:

### Causa 1: La tecla Enter envía el formulario principal prematuramente

Cuando el usuario pulsa Enter en el campo "Importe" del editor de asignaciones, en lugar de añadir la asignación a la tabla, el evento `Enter` propaga hacia arriba y **envía el formulario principal** (`<form onSubmit>`). 

**Secuencia del bug:**
1. Usuario selecciona presupuesto y escribe importe
2. Pulsa Enter (pensando que añade la asignación)
3. El formulario principal se envía
4. En ese momento `budgetAllocations = []` (vacío) porque nunca se pulsó el botón +
5. Se guarda la factura sin ninguna asignación

### Causa 2: Guardar con tipo "budgets" pero sin asignaciones efectivas

Aunque el usuario haya seleccionado `associationType = 'budgets'`, si `budgetAllocations` está vacío (porque no pulsó el botón + o porque Enter envió el form antes), el código actual guarda un array vacío:

```typescript
if (associationType === 'budgets') {
  await saveAllocationsMutation.mutateAsync({
    invoiceId: invoice.id,
    allocations: budgetAllocations, // ← Puede ser []
  });
}
```

---

## Solución Propuesta

### 1. Prevenir que Enter envíe el formulario desde el editor de asignaciones

En `BudgetAllocationEditor.tsx`, añadir `onKeyDown` al campo de importe para:
- Prevenir la propagación del evento Enter
- Opcionalmente, ejecutar la acción de añadir asignación

```typescript
<Input
  type="number"
  ...
  onKeyDown={(e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // Si hay un presupuesto seleccionado, añadir la asignación
      if (selectedBudgetId) {
        handleAddAllocation();
      }
    }
  }}
/>
```

### 2. Validar que existan asignaciones antes de guardar

En `InvoiceFormModal.tsx`, en la función `onSubmit`, añadir validación:

```typescript
if (associationType === 'budgets' && budgetAllocations.length === 0) {
  toast.error('Añade al menos una asignación de presupuesto o selecciona "Sin asociar"');
  return;
}
```

### 3. Añadir logs de depuración (temporal)

Añadir console.logs en puntos clave para verificar el estado al guardar:
- Justo antes de llamar a `updateMutation.mutate(data)`
- En el `mutationFn` de `updateMutation`

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/invoices/BudgetAllocationEditor.tsx` | Añadir `onKeyDown` para prevenir Enter y añadir asignación |
| `src/components/modals/InvoiceFormModal.tsx` | Añadir validación de asignaciones vacías + logs de depuración |

---

## Resultado Esperado

1. Cuando el usuario pulsa Enter en el campo de importe, la asignación se añade a la tabla (en lugar de enviar el formulario)
2. Si el usuario intenta guardar con "Presupuesto(s)" seleccionado pero sin asignaciones, aparece un error claro
3. Los logs de consola permitirán verificar el estado exacto al momento de guardar

