

# Plan: Mostrar Título del Presupuesto en Columna "Proyecto/Pres."

## Problema Identificado

En la vista de detalle de liquidaciones, la columna "Proyecto/Pres." muestra solo el código del presupuesto (ej: `PRE-2025-201`) en lugar del título descriptivo (ej: `Switzerland without borders | Inbound Marketing Campaign`).

La query ya incluye el campo `title` del presupuesto, pero el código de renderizado solo usa el campo `code`.

## Ubicaciones a Modificar

| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `src/pages/LiquidacionDetalle.tsx` | ~190 | PendingRequestsSection - tabla de trabajos pendientes |
| `src/pages/LiquidacionDetalle.tsx` | ~839 | Trabajos del líder de equipo |
| `src/pages/LiquidacionDetalle.tsx` | ~951 | Trabajos de miembros del equipo |
| `src/pages/LiquidacionDetalle.tsx` | ~1051 | Trabajos incluidos (liquidación individual) |
| `src/utils/pdf/liquidationPDFGenerator.ts` | ~733-734 | Función `getProjectOrBudgetFromItem` |
| `src/utils/pdf/liquidationPDFGenerator.ts` | ~746-747 | Función `getProjectOrBudgetName` |

## Cambios a Realizar

### 1. LiquidacionDetalle.tsx - UI (4 ubicaciones)

**Antes:**
```tsx
{item.financial_request.budget.code}
```

**Después:**
```tsx
{item.financial_request.budget.title || item.financial_request.budget.code}
```

Con truncado para evitar columnas muy anchas (ej: máx 35 caracteres + "...").

### 2. liquidationPDFGenerator.ts - PDF Export

**Función `getProjectOrBudgetFromItem`:**
```typescript
// Antes:
if (item.financial_request?.budget?.code) {
  return item.financial_request.budget.code;
}

// Después:
if (item.financial_request?.budget) {
  const budget = item.financial_request.budget;
  const name = budget.title || budget.code;
  return name.length > 25 ? name.substring(0, 23) + '...' : name;
}
```

**Función `getProjectOrBudgetName`:**
```typescript
// Antes:
if (req.budget?.code) {
  return req.budget.code;
}

// Después:
if (req.budget) {
  const name = req.budget.title || req.budget.code;
  return name.length > 18 ? name.substring(0, 16) + '...' : name;
}
```

## Resultado Esperado

| Antes | Después |
|-------|---------|
| `PRE-2025-201` | `Switzerland without borders...` |
| `PRE-2026-005` | `ePAQ GO Translations` |

Los proyectos operacionales seguirán mostrando su nombre como hasta ahora. Solo cambia el display de presupuestos.

