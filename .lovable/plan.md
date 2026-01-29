
# Plan: Agrupar Trabajos en Liquidación por Cliente y Proyecto/Presupuesto

## Objetivo

Reorganizar la tabla "Trabajos incluidos" en el detalle de liquidación para mostrar los items agrupados jerárquicamente:

```
📁 CLIENTE A (Subtotal: X €)
   📂 Proyecto/Presupuesto 1 (Subtotal: Y €)
      └─ REQ-2025-001 - Descripción 1
      └─ REQ-2025-002 - Descripción 2
   📂 Proyecto/Presupuesto 2 (Subtotal: Z €)
      └─ REQ-2025-003 - Descripción 3
📁 CLIENTE B (Subtotal: W €)
   ...
```

## Estructura Actual vs Propuesta

| Actual | Propuesto |
|--------|-----------|
| Lista plana de requests | Agrupación jerárquica por Cliente → Proyecto/Presupuesto |
| Sin subtotales visuales | Subtotal por cliente + subtotal por proyecto |
| Sin separación visual | Filas destacadas para cabeceras de grupo |

## Cambios Propuestos

### 1. Crear función helper de agrupación jerárquica

```typescript
interface GroupedProjectBudget {
  id: string;
  name: string;
  type: 'project' | 'budget' | 'none';
  items: any[];
  subtotal: number;
}

interface GroupedClient {
  clientId: string;
  clientName: string;
  projectBudgets: GroupedProjectBudget[];
  subtotal: number;
}

const groupItemsByClientAndProject = (items: any[]): GroupedClient[] => {
  // 1. Agrupar por cliente
  // 2. Dentro de cada cliente, agrupar por proyecto/presupuesto
  // 3. Calcular subtotales
};
```

### 2. Actualizar estructura de la tabla en `LiquidacionDetalle.tsx`

**Para la tabla de "Trabajos incluidos":**

```tsx
{groupedItems.map((clientGroup) => (
  <>
    {/* Fila de cabecera de cliente */}
    <TableRow className="bg-slate-100 dark:bg-slate-800">
      <TableCell colSpan={6} className="font-bold">
        {clientGroup.clientName}
      </TableCell>
      <TableCell className="text-right font-bold">
        {formatCurrency(clientGroup.subtotal)}
      </TableCell>
    </TableRow>
    
    {clientGroup.projectBudgets.map((projectGroup) => (
      <>
        {/* Fila de cabecera de proyecto/presupuesto */}
        <TableRow className="bg-muted/50">
          <TableCell colSpan={6} className="pl-8 font-medium text-emerald-600">
            {projectGroup.name}
          </TableCell>
          <TableCell className="text-right font-medium">
            {formatCurrency(projectGroup.subtotal)}
          </TableCell>
        </TableRow>
        
        {/* Filas de items individuales */}
        {projectGroup.items.map((item) => (
          <TableRow className="pl-12">
            {/* ... datos del item ... */}
          </TableRow>
        ))}
      </>
    ))}
  </>
))}
```

### 3. Diseño Visual de la Tabla

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Trabajos incluidos                                      [+ Añadir] [+ Concepto]     │
├───────────┬──────────────────────────┬────────┬──────────┬────────┬────────┬────────┤
│ Código    │ Descripción              │ Cant.  │ Precio   │ Total  │        │        │
├═══════════╪══════════════════════════════════════════════════════════════╪═════════┤
│ 🏢 ASENDIA HQ                                                            │ 535,00 €│
├───────────┼──────────────────────────────────────────────────────────────┼─────────┤
│   📁 ePAQ GO Translations                                                │ 120,00 €│
├───────────┼──────────────────────────┬────────┬──────────┬────────┬──────┼─────────┤
│     REQ-2025-098 │ Content localisat...│  2     │ 60,00 €  │ 60,00 € │ 🗑  │         │
│     REQ-2025-111 │ Translation Page...  │  0.5   │ 15,00 €  │ 15,00 € │ 🗑  │         │
│     REQ-2025-114 │ OHH section Trans... │  0.5   │ 15,00 €  │ 15,00 € │ 🗑  │         │
│     ...          │                      │        │          │        │     │         │
├───────────┼──────────────────────────────────────────────────────────────┼─────────┤
│   📁 Inbound Marketing Campaign: Switzerland                             │ 250,00 €│
├───────────┼──────────────────────────┬────────┬──────────┬────────┬──────┼─────────┤
│     REQ-2026-101 │ Traducción y loca...│  5     │ 125,00 €  │ 125,00 €│ 🗑  │         │
│     REQ-2026-129 │ Gestión CRM - Ema...│  5     │ 125,00 €  │ 125,00 €│ 🗑  │         │
├═══════════╪══════════════════════════════════════════════════════════════╪═════════┤
│ 🏢 Asendia USA Inc                                                       │ 75,00 € │
├───────────┼──────────────────────────────────────────────────────────────┼─────────┤
│   📁 Newsletter Q4 USA                                                   │ 75,00 € │
├───────────┼──────────────────────────┬────────┬──────────┬────────┬──────┼─────────┤
│     REQ-2026-131 │ Translation EN>ES │  3     │ 75,00 €  │ 75,00 € │ 🗑   │         │
└───────────┴──────────────────────────┴────────┴──────────┴────────┴──────┴─────────┘
```

### 4. Ordenación

Los grupos se ordenarán de la siguiente manera:
1. **Clientes**: Alfabéticamente por nombre
2. **Proyectos/Presupuestos dentro de cada cliente**: Alfabéticamente por nombre
3. **Requests dentro de cada proyecto**: Por código de request

### 5. Casos Especiales

| Caso | Tratamiento |
|------|-------------|
| Request sin cliente | Grupo "Sin cliente asignado" |
| Request sin proyecto/presupuesto | Sub-grupo "Sin proyecto" dentro del cliente |
| Concepto manual (sin financial_request) | Grupo "Otros conceptos" al final |

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/LiquidacionDetalle.tsx` | Implementar agrupación jerárquica en las tablas de items (tanto para liquidación individual como para equipos) |
| `src/utils/pdf/liquidationPDFGenerator.ts` | Actualizar `groupItemsByClient` y `buildTableData` para incluir sub-agrupación por proyecto/presupuesto |
| `src/pages/FirmaLiquidacion.tsx` | (Opcional) Aplicar la misma agrupación en la vista de firma pública |

---

## Detalles Técnicos

### Función de Agrupación

```typescript
const groupItemsByClientAndProject = (items: any[]): GroupedClient[] => {
  const clientMap = new Map<string, GroupedClient>();
  
  items.forEach((item) => {
    const clientId = item.financial_request?.client?.id || 'no-client';
    const clientName = item.financial_request?.client?.name || 
      (item.financial_request_id ? 'Sin cliente' : 'Otros conceptos');
    
    // Obtener proyecto o presupuesto
    const opRequest = item.financial_request?.operational_request?.[0];
    const project = opRequest?.operational_project;
    const budget = item.financial_request?.budget;
    
    let projectBudgetId = 'no-project';
    let projectBudgetName = 'Sin proyecto/presupuesto';
    let projectBudgetType: 'project' | 'budget' | 'none' = 'none';
    
    if (project) {
      projectBudgetId = project.id;
      projectBudgetName = project.name;
      projectBudgetType = 'project';
    } else if (budget) {
      projectBudgetId = budget.id;
      projectBudgetName = budget.title || budget.code;
      projectBudgetType = 'budget';
    }
    
    // Agrupar...
  });
  
  // Ordenar y devolver
  return Array.from(clientMap.values()).sort((a, b) => 
    a.clientName.localeCompare(b.clientName)
  );
};
```

### Renderizado de Filas de Cabecera

```tsx
// Fila de cabecera de cliente
<TableRow className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800">
  <TableCell colSpan={isEditable ? 7 : 6} className="font-bold py-3">
    <span className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-slate-600" />
      {clientGroup.clientName}
    </span>
  </TableCell>
  <TableCell className="text-right font-bold">
    {formatCurrency(clientGroup.subtotal)}
  </TableCell>
</TableRow>

// Fila de cabecera de proyecto/presupuesto
<TableRow className="bg-muted/30 hover:bg-muted/30">
  <TableCell colSpan={isEditable ? 7 : 6} className="font-medium py-2 pl-8">
    <span className="flex items-center gap-2 text-emerald-600">
      {projectGroup.type === 'project' ? (
        <FolderKanban className="h-3.5 w-3.5" />
      ) : (
        <FileSpreadsheet className="h-3.5 w-3.5" />
      )}
      {projectGroup.name}
    </span>
  </TableCell>
  <TableCell className="text-right font-medium text-muted-foreground">
    {formatCurrency(projectGroup.subtotal)}
  </TableCell>
</TableRow>
```

---

## Beneficios

1. **Claridad**: Los usuarios ven inmediatamente cuánto factura cada cliente y proyecto
2. **Verificación**: Facilita revisar que todos los trabajos de un cliente/proyecto están incluidos
3. **Profesionalismo**: Presentación más organizada tanto en web como en PDF
4. **Consistencia**: La agrupación será igual en la vista web que en el PDF generado

---

## Consideraciones de Rendimiento

- La agrupación se realiza en el frontend con los datos ya cargados
- No requiere cambios en la base de datos ni en las queries
- Para liquidaciones con muchos items (100+), se usará `useMemo` para evitar recálculos innecesarios
