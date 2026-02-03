## Añadir columna "Fecha de Facturación" a listado de presupuestos

### Contexto
La tabla de presupuestos (`BudgetTableView`) actualmente muestra las columnas: Código, Título, Cliente, Monto Total, Estado, Válido Hasta y Acciones. El campo `estimated_invoice_date` ya existe en la base de datos.

### Cambios a realizar

**1. Tabla de presupuestos (`BudgetTableView.tsx`)**
- **Reemplazar** la columna "Válido Hasta" por "Fecha Facturación"
- Mostrar `estimated_invoice_date` formateada con `date-fns` o "-" si no está definida
- El `colSpan` se mantiene en 7 (no cambia el número de columnas)

**2. Vista de tarjetas (`BudgetCard.tsx`)**
- **Reemplazar** el campo "Válido Hasta" por "Fecha Facturación"
- Mantener la grilla de `grid-cols-2`
- Mostrar "No especificado" si el campo está vacío

### Resultado visual esperado

**Tabla:**
| Código | Título | Cliente | Monto Total | Estado | Fecha Facturación | Acciones |

**Tarjeta:**
```
┌─────────────────────────────────────────┐
│  PRE-2026-010                           │
│  Trade fair participation...  [Aprobado]│
│  Asendia Germany                        │
├─────────────────────────────────────────┤
│  Monto Total        Fecha Facturación   │
│  280,00 €           15 Feb 2026         │
└─────────────────────────────────────────┘
```

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/budgets/BudgetTableView.tsx` | Reemplazar "Válido Hasta" por "Fecha Facturación" |
| `src/components/budgets/BudgetCard.tsx` | Reemplazar "Válido Hasta" por "Fecha Facturación" |
