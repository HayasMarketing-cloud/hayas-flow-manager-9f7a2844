

# Plan: Corregir Visibilidad de Presupuestos Parcialmente Facturados

## Problema Identificado

Al intentar asociar la factura 2026/8 al presupuesto PRE-2025-203 (que ya tiene una factura parcial asociada), el presupuesto aparece en el dropdown pero **no es seleccionable**.

### Análisis Técnico

El sistema actual ya soporta asociaciones múltiples (N:M entre facturas y presupuestos), pero hay un problema en la lógica de filtrado:

En `BudgetAllocationEditor.tsx` línea 133:
```typescript
disabled={budget.is_fully_invoiced}
```

Este flag se calcula en `useInvoiceBudgetAllocations.tsx` línea 260:
```typescript
is_fully_invoiced: remaining <= 0
```

El problema es que `is_fully_invoiced` se usa para **deshabilitar** el SelectItem, lo cual impide seleccionar presupuestos que ya tienen alguna factura aunque tengan importe pendiente.

---

## Solución Propuesta

### Cambio 1: Ajustar la Lógica de `is_fully_invoiced`

El flag solo debe ser `true` cuando el importe restante es realmente cero o negativo. Actualmente parece funcionar correctamente según el código, pero añadiré logging para debug y verificaré el cálculo.

### Cambio 2: Mostrar Indicador Visual sin Deshabilitar

En lugar de deshabilitar completamente los presupuestos "fully invoiced", mostrarlos con un indicador visual diferente pero permitir la selección (útil para casos de sobre-facturación intencional o correcciones).

### Cambio 3: Mejorar el Feedback Visual

Mostrar claramente:
- Importe total del presupuesto
- Importe ya facturado (de otras facturas)
- Importe restante disponible
- Indicador de estado (Disponible / Parcialmente facturado / Completamente facturado)

---

## Cambios por Archivo

### `src/components/invoices/BudgetAllocationEditor.tsx`

| Línea | Cambio |
|-------|--------|
| 133 | Quitar `disabled={budget.is_fully_invoiced}` - permitir siempre la selección |
| 139-141 | Mejorar el badge para mostrar estado más claro |
| Nuevo | Añadir indicador de advertencia si el presupuesto ya está 100% facturado |

### `src/hooks/useInvoiceBudgetAllocations.tsx`

| Cambio | Descripción |
|--------|-------------|
| Línea 260 | Verificar que el cálculo de `remaining` usa tolerancia decimal (evitar falsos positivos por redondeo) |
| Debug | Añadir console.log temporal para verificar los valores calculados |

---

## Nueva UI del Selector

```text
┌─────────────────────────────────────────────────────────────┐
│ Seleccionar presupuesto...                              [▼] │
├─────────────────────────────────────────────────────────────┤
│ PRE-2026-007 - Localization epaq Brochure                   │
│   Total: 700,00 € | Disp: 700,00 € ✓                       │
├─────────────────────────────────────────────────────────────┤
│ PRE-2025-203 - Localización contenidos e-PAQ GO            │
│   Total: 1197,89 € | Facturado: 600,00 € | Disp: 597,89 € ⚠│
├─────────────────────────────────────────────────────────────┤
│ PRE-2025-100 - Otro Presupuesto (ya completado)            │
│   Total: 500,00 € | Facturado: 500,00 € | Disp: 0,00 € ⛔   │
└─────────────────────────────────────────────────────────────┘
```

Leyenda:
- ✓ Verde: Disponible completamente
- ⚠ Amarillo: Parcialmente facturado, aún tiene disponible
- ⛔ Rojo: Completamente facturado (pero seleccionable con advertencia)

---

## Sección Técnica

### Nuevo Código para BudgetAllocationEditor

```typescript
// Línea 129-145 - Reemplazar SelectItem
{unallocatedBudgets.map(budget => {
  const isPartiallyInvoiced = budget.invoiced_amount > 0 && !budget.is_fully_invoiced;
  const isFullyInvoiced = budget.is_fully_invoiced;
  
  return (
    <SelectItem 
      key={budget.id} 
      value={budget.id}
      // Ya no deshabilitamos - solo mostramos advertencia
    >
      <div className="flex flex-col gap-1 py-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{budget.code}</span>
          <span className="text-muted-foreground">-</span>
          <span className="truncate max-w-[150px]">{budget.title}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span>Total: {formatCurrency(budget.total_amount)}</span>
          {budget.invoiced_amount > 0 && (
            <span className="text-muted-foreground">
              | Facturado: {formatCurrency(budget.invoiced_amount)}
            </span>
          )}
          <Badge 
            variant={isFullyInvoiced ? "destructive" : isPartiallyInvoiced ? "secondary" : "outline"} 
            className="text-xs"
          >
            Disp: {formatCurrency(budget.remaining_amount)}
          </Badge>
        </div>
      </div>
    </SelectItem>
  );
})}
```

### Tolerancia Decimal en Hook

```typescript
// useInvoiceBudgetAllocations.tsx línea 260
is_fully_invoiced: remaining <= 0.01, // Tolerancia de 1 céntimo
```

---

## Resumen de Cambios

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `BudgetAllocationEditor.tsx` | Modificar | Quitar disabled, mejorar UI del selector |
| `useInvoiceBudgetAllocations.tsx` | Modificar | Añadir tolerancia decimal al cálculo |

