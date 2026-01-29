
# Plan: Añadir columnas Proyecto, Presupuesto y Contrato a la tabla de Facturas

## Análisis

Analizando la imagen proporcionada, la tabla de facturas actual muestra:
- Checkbox de selección
- Código
- Cliente
- Fecha
- Vencimiento
- Subtotal
- IVA
- Total
- Estado
- PDF
- Acciones

Se solicita añadir tres nuevas columnas: **Proyecto**, **Presupuesto** y **Contrato**.

### Origen de los datos

Las facturas se relacionan indirectamente con proyectos/presupuestos/contratos a través de:
1. `financial_requests.billed_invoice_id` → apunta a la factura
2. Cada `financial_request` tiene `budget_id` y `contract_id`
3. Los proyectos operativos se obtienen vía `operational_requests.financial_request_id`

Una factura puede tener múltiples solicitudes asociadas, por lo que podría tener varios presupuestos, contratos y proyectos.

---

## Cambios Propuestos

### 1. Modificar la query en `src/pages/Facturas.tsx`

Agregar una subquery o join para obtener los datos relacionados de cada factura.

```typescript
// Antes
.select(`
  *,
  client:clients(id, name, code)
`)

// Después - añadir datos relacionados
.select(`
  *,
  client:clients(id, name, code),
  linked_requests:financial_requests!financial_requests_billed_invoice_id_fkey(
    id,
    code,
    budget:budgets(id, code, title),
    contract:contracts(id, code, title),
    operational_request:operational_requests(
      operational_project:operational_projects(id, name)
    )
  )
`)
```

### 2. Actualizar `src/components/invoices/InvoiceTableView.tsx`

**Añadir las nuevas columnas en el encabezado:**

| Posición | Nueva Columna |
|----------|--------------|
| Después de "Cliente" | Proyecto |
| Después de "Proyecto" | Presupuesto |
| Después de "Presupuesto" | Contrato |

**Implementar celdas que extraigan y muestren los datos únicos:**

```tsx
// Helper para extraer valores únicos de las solicitudes vinculadas
const getUniqueProjects = (invoice: any) => {
  if (!invoice.linked_requests) return [];
  return [...new Set(
    invoice.linked_requests
      .flatMap(r => r.operational_request || [])
      .map(or => or.operational_project)
      .filter(Boolean)
  )];
};
```

**Reutilizar el componente `OriginCell`** existente o crear celdas similares con:
- Iconos distintivos (FolderKanban, FileSpreadsheet, ScrollText)
- Tooltips con nombre completo
- Enlaces a las páginas de detalle
- Manejo de múltiples valores (mostrar el primero + badge con "+X")

### 3. Actualizar el colspan del mensaje vacío

Cambiar `colSpan={11}` → `colSpan={14}` para incluir las 3 nuevas columnas.

---

## Diseño Visual de las Nuevas Columnas

```text
| ... | Cliente    | Proyecto        | Presupuesto  | Contrato       | Fecha | ...
|-----|------------|-----------------|--------------|----------------|-------|
|     | ASENDIA HQ | 📁 Localización | 📄 PRE-2025-001 | 📜 CTR-2025-001 | 01/12 |
|     | CLIENTE X  | ---             | 📄 PRE-2025-002 | ---            | 05/12 |
|     | CLIENTE Y  | 📁 Proyecto +2  | ---          | 📜 Retainer    | 08/12 |
```

### Comportamiento esperado:
- **Sin datos**: Mostrar "---" en gris
- **Un valor**: Mostrar icono + nombre truncado (tooltip completo)
- **Múltiples valores**: Mostrar primero + badge "+N" con tooltip listando todos

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/Facturas.tsx` | Expandir select query para incluir datos relacionados |
| `src/components/invoices/InvoiceTableView.tsx` | Añadir 3 columnas con celdas que muestren proyectos, presupuestos y contratos |

---

## Detalles Técnicos

### Query actualizada

```typescript
const { data: invoices, isLoading } = useQuery({
  queryKey: ['invoices', filters, needsFiltering, assignedClientIds, isOverdueFilter],
  queryFn: async () => {
    // ... existing filter logic ...
    
    let query = supabase
      .from('invoices')
      .select(`
        *,
        client:clients(id, name, code),
        linked_requests:financial_requests!billed_invoice_id(
          id,
          budget:budgets(id, code, title),
          contract:contracts(id, code, title),
          operational_request:operational_requests(
            operational_project:operational_projects(id, name)
          )
        )
      `)
      .order('due_date', { ascending: true, nullsFirst: false });
    // ... rest of query logic ...
  }
});
```

### Componentes de celdas

Para las celdas de Proyecto, Presupuesto y Contrato, se creará un helper que:
1. Extrae valores únicos de `linked_requests`
2. Muestra el primero con icono y tooltip
3. Si hay más de uno, añade un badge "+N"

```tsx
// Ejemplo de celda para Proyecto
<TableCell>
  <InvoiceOriginBadge
    items={getUniqueProjects(invoice)}
    type="project"
    icon={<FolderKanban className="h-3.5 w-3.5" />}
    basePath="/operaciones/proyectos"
  />
</TableCell>
```

---

## Compatibilidad

- Los datos actuales no tienen solicitudes vinculadas a facturas, pero la infraestructura está preparada
- Las columnas mostrarán "---" hasta que se vinculen solicitudes a facturas
- No hay cambios de base de datos requeridos - solo lectura de relaciones existentes
