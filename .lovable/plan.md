
## Mejora de la sección "Estado de Facturación" en Detalle Económico del Presupuesto

### Objetivo
Enriquecer la sección "Estado de Facturación" en la pestaña "Detalle Económico" del presupuesto para mostrar:
1. **Fecha de facturación prevista** (`estimated_invoice_date`)
2. **Enlace al documento de factura** (`pdf_url`) cuando exista una factura vinculada

---

### Cambios a realizar

**1. Hook `useBudgetAllocations` (`src/hooks/useInvoiceBudgetAllocations.tsx`)**
- Añadir `pdf_url` a la consulta de invoices en la función `useBudgetAllocations`
- Actualmente la consulta es:
  ```typescript
  invoice:invoices(id, code, status, total_amount, invoice_date)
  ```
- Modificar a:
  ```typescript
  invoice:invoices(id, code, status, total_amount, invoice_date, pdf_url)
  ```

**2. Componente `BudgetLinkedInvoicesCard` (`src/components/budgets/BudgetLinkedInvoicesCard.tsx`)**

Añadir nueva prop `estimatedInvoiceDate`:
```typescript
interface BudgetLinkedInvoicesCardProps {
  budgetId: string;
  budgetTotal: number;
  estimatedInvoiceDate?: string | null;
}
```

Modificar la estructura del componente:

| Sección | Cambio |
|---------|--------|
| Antes de la tabla | Mostrar "Fecha de facturación prevista: dd/MM/yyyy" o "No especificada" |
| Columna de la tabla | Añadir columna "Documento" con icono/enlace al PDF |
| Mensaje vacío | Mantener "No hay facturas vinculadas a este presupuesto" |

**Estructura visual propuesta:**

```
┌────────────────────────────────────────────────────────────┐
│ 🧾 Estado de Facturación                                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ 📅 Fecha de facturación prevista: 15/02/2026              │
│                                                            │
│ ┌─ Pendiente facturar ─────────────────────────────────┐   │
│ │ 0,00 € / 1.540,00 € (0%) - Pendiente: 1.540,00 €    │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Factura │ Fecha      │ Importe    │ Estado  │ Doc    │   │
│ ├─────────┼────────────┼────────────┼─────────┼────────┤   │
│ │ 2026/14 │ 03/02/2026 │ 1.225,00 € │ Pend.   │ 📎    │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                            │
│ 1 factura vinculada           Total facturado: 1.225,00 € │
└────────────────────────────────────────────────────────────┘
```

**3. Integración en `PresupuestoDetalle.tsx`**
- Pasar la nueva prop `estimatedInvoiceDate` al componente `BudgetLinkedInvoicesCard`

---

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useInvoiceBudgetAllocations.tsx` | Añadir `pdf_url` a la consulta de invoices |
| `src/components/budgets/BudgetLinkedInvoicesCard.tsx` | Nueva prop + mostrar fecha + columna documento con enlace |
| `src/pages/PresupuestoDetalle.tsx` | Pasar `estimatedInvoiceDate` al componente |

---

### Detalles de implementación

**Fecha de facturación prevista:**
- Mostrar un badge con icono de calendario 📅
- Formatear con `date-fns`: `format(new Date(date), 'dd/MM/yyyy', { locale: es })`
- Si no hay fecha: "No especificada" en gris

**Columna de documento:**
- Si `pdf_url` existe: Mostrar botón con icono `FileText` que abre el PDF en nueva pestaña
- Si no existe: Mostrar icono gris con tooltip "Sin documento"
- Usar `window.open(pdf_url, '_blank')` para abrir

**Orden de elementos en el card:**
1. Fecha de facturación prevista (nueva)
2. Estado de asignación (existente `BudgetAllocationStatus`)
3. Tabla de facturas (con nueva columna Documento)
4. Resumen (existente)
