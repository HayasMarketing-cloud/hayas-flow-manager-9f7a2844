
# Plan: Corregir cálculo de total cuando IVA es 0 y subtotal manual

## Problema detectado

Hay dos problemas en el cálculo del total de facturas:

### Problema 1: IVA = 0 se interpreta como 21%
En la línea 92 del archivo:
```typescript
const taxRate = watch('tax_rate') || 21;
```

El operador `||` considera `0` como un valor "falsy", por lo que cuando el usuario ingresa 0% de IVA, la expresión `0 || 21` devuelve `21` en lugar de `0`.

### Problema 2: El subtotal manual no se usa cuando hay items vacíos
El cálculo actual prioriza siempre los items sobre el subtotal manual:
```typescript
const subtotal = invoiceItems.length > 0 ? itemsSubtotal : manualSubtotal;
```

Si existen registros en `invoice_items` (aunque estén vacíos o tengan total 0), se usa la suma de items en lugar del subtotal manual que el usuario acaba de modificar.

## Solución

### Cambio 1: Usar nullish coalescing para el IVA
Cambiar de `||` a `??` para que solo use 21 cuando el valor es `null` o `undefined`, no cuando es `0`:
```typescript
const taxRate = watch('tax_rate') ?? 21;
```

### Cambio 2: Priorizar subtotal con valor real
Modificar la lógica para usar el subtotal que tenga un valor real:
```typescript
const subtotal = itemsSubtotal > 0 ? itemsSubtotal : manualSubtotal;
```

Esto asegura que si los items suman 0 pero hay un subtotal manual, se use el manual.

## Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/modals/InvoiceFormModal.tsx` | Líneas 91-92: Corregir lógica de cálculo de subtotal y taxRate |

## Resultado esperado

- Cuando el IVA sea 0%, el total será igual al subtotal (sin añadir IVA)
- Cuando se modifique el subtotal manual, el total se recalculará correctamente
- Las facturas importadas sin líneas de detalle mostrarán el subtotal y total correctos
